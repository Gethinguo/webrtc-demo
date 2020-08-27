<template>
    <div>
        <div>
            <p>想做一个远程呼叫的例子</p>
            <p>1.这里是个房间</p>
            <p>2.进房间输入自己的名字</p>
            <p>3.可以选择一个人去呼叫</p>
            <p>3.2个人可以视频通话</p>
            <button style="margin: 0 10px" @click="clearAll">清空房间</button>
            <button style="margin: 0 10px" @click="hangup" v-show="isCall">挂断</button>
            <!--<div @click="ceshi1">测试连接</div>-->
        </div>
        <div class="main">
            <div class="list">
                你的用户名：
                <input v-model="account" type="text" id="inputName">
                <button @click="join">确定</button>
                <p>人员列表</p>
                <div v-for="v in userList" class="personbox">
                    <p>{{v.account}}</p>
                    <p>{{v.account === account?'自己':'其他人'}}</p>
                    <p v-show="v.account !== account" @click="apply(v.account)">呼叫</p>
                </div>
            </div>
            <div class="right">
                <p>视频区</p>
                <div style="display: flex">
                    <div>
                        <p style="text-align: center;font-weight: bold">我的：</p>
                        <video src="" id="rtcA" controls autoplay class=""></video>
                        <div v-show="isCall">
                            <Input v-model="sendText" maxlength="100" :rows="5" show-word-limit type="textarea" placeholder="信息"
                                   style="width: 200px" @on-enter="send"/>
                            <button @click="send">发送</button>
                        </div>
                    </div>
                    <div>
                        <p style="text-align: center;font-weight: bold">对方的：</p>
                        <video src="" id="rtcB" controls autoplay class=""></video>
                        <div v-show="isCall">
                            <p>信息记录：</p>
                            <p v-for="v in receiveTextArr" style="text-align: left;padding: 0 0 10px 20px">
                                {{v.name}}:{{v.text}}
                            </p>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    </div>
</template>

<script>
    import socket from '@/utils/socket'

    export default {
        name: "remote",
        data() {
            return {
                account: window.sessionStorage.account || '',
                roomid: 'webrtc_1v1', // 指定房间ID
                userList: [],
                isCall: false,
                isToPeer: false, // 是否建立了 P2P 连接
                localstream: null, // 本地视频流
                peer: null, //

                sendText: '',
                receiveTextArr: [],
                offerOption: {
                    offerToReceiveAudio: 1,
                    offerToReceiveVideo: 1
                }
            }
        },
        mounted() {
            this.initSocket()
            if (this.account) {
                this.join();
            }
        },
        methods: {
            initSocket() {
                socket.on('joined', (data) => {
                    console.log('有人加入了房间')
                    console.log(data)
                    this.userList = data
                })
                socket.on('clearAll', (data) => {
                    console.log('清空了了房间')
                    console.log(data)
                    this.userList = data
                })
                socket.on('apply', (data) => { //收到请求
                    if (this.isCall) {
                        this.reply(data.self, '3');
                        return;
                    }
                    this.$Modal.confirm({
                        title: 'Title',
                        content: data.self + ' 向你请求视频通话, 是否同意?',
                        okText: '同意',
                        cancelText: '不同意',
                        onOk: async () => {
                            await this.createP2P(data); // 同意之后创建自己的 peer 等待对方的 offer
                            this.isCall = data.self;
                            this.reply(data.self, '1');
                        },
                        onCancel: () => {
                            this.reply(data.self, '2');
                        }
                    });
                })
                socket.on('reply', async (data) => { //收到回复
                    console.log('收到reply')
                    console.log(data)
                    // 把呼叫中的loading取消
                    this.$Message.destroy()
                    if (data.type) {
                        switch (data.type) {
                            case '1':
                                this.$Message.destroy()
                                // 同意的情况
                                this.isCall = data.self
                                // 开始 交换SDP offer，建立连接
                                await this.createP2P(data);
                                // 并给对方发送 offer sdp
                                this.createOffer(data);
                                break;
                            case '2':
                                this.$Message.warning('对方拒绝的请求');
                                break;
                            case '3':
                                this.$Message.warning('对方正在通话中');
                                break;
                            default:
                                console.log('其他情况')
                        }

                    }
                })
                socket.on('1v1ICE', (data) => {
                    //接受到 ice
                    this.onIce(data)
                })
                socket.on('1v1offer', data => {
                    // 接受offer sdp
                    this.onOffer(data)
                })
                socket.on('1v1answer', data => {
                    // 接受到 answer
                    this.onAnswer(data)
                })
                socket.on('1v1hangup', data => {
                    this.$Message.warning('对方挂断通话');
                    this.peer.close();
                    this.peer = null;
                    this.isToPeer = false;
                    this.isCall = false;
                })

                socket.on('connect', () => {
                    console.log('连接成功');
                });
                socket.on('disconnect', () => {
                    console.log('连接断开了');
                });
                socket.on('ceshi1huifu', (data) => {
                    console.log('这是测试回复');
                    console.log(data);
                });
            },
            join() {
                if (!this.account) return;

                window.sessionStorage.account = this.account;
                socket.emit('join', {roomid: this.roomid, account: this.account});
            },
            apply(account) {
                this.$Message.loading({
                    content: '开始呼叫',
                    duration: 0
                })
                socket.emit('apply', {account: account, self: this.account});
            },
            reply(account, type) {
                socket.emit('reply', {account: account, self: this.account, type: type});
            },
            async createP2P(data) {
                this.$Message.loading({
                    content: '开始建立通话连接',
                    duration: 0
                })
                await  this.createMedia(data)
            },
            async createMedia(data) {
                // 保存本地流到全局
                try {
                    this.localstream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
                    let video = document.querySelector('#rtcA');
                    video.srcObject = this.localstream;
                } catch (e) {
                    console.log('getUserMedia: ', e)
                }
                this.initPeer(data); // 获取到媒体流后，调用函数初始化 RTCPeerConnection
            },
            initPeer(data) {
                let PeerConnection = window.RTCPeerConnection
                this.peer = new PeerConnection()
                this.peer.addStream(this.localstream)

                // 监听ICE候选信息 如果收集到，就发送给对方
                this.peer.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('1v1ICE', {account: data.self, self: this.account, sdp: event.candidate});
                    }
                };
                //监听是否有媒体流接入，如果有就赋值给 rtcB 的 src
                this.peer.onaddstream = ((e) => {
                    this.isToPeer = true;
                    this.$Message.destroy()
                    let video = document.getElementById('rtcB')
                    video.srcObject = e.stream
                })

                /** 创建一个可以发送任意数据的数据通道，对视频没有影响，不加一样 */
                this.channelB = this.peer.createDataChannel('messagechannel')
                console.log('this.channelB', this.channelB);
                this.channelB.binaryType = 'arraybuffer'
                this.channelB.onopen = (event) => {
                    console.log('channelB onopen', event);
                    this.messageOpen = true;
                }
                this.channelB.onclose = function (event) {
                    console.log('channelB onclose', event)
                }

                /** 数据通道的处理，对视频没有影响 */
                this.peer.ondatachannel = (event) => {
                    console.log('监听数据通道变化')
                    console.log(event)
                    this.channelA = event.channel
                    this.channelA.binaryType = 'arraybuffer'
﻿                    this.channelA.onopen = (e) => {
                        console.log('channelA onopen', e)
                    }
                    this.channelA.onclose = (e) => {
                        console.log('channelA onclose', e)
                    };
                    this.channelA.onmessage = (e) => {
                        this.receiveTextArr.push({name:JSON.parse(e.data).self,text:JSON.parse(e.data).name})
                        console.log('channelA onmessage', e.data)
                    };
                };
            },
            /**
             * 接受到了 ice 候选人
             * ICE的全称是Interactive Connectivity Establishment （翻译是交互式连接建立）
             */
            async onIce(data) {
                // 设置远程 ICE
                await this.peer.addIceCandidate(data.sdp)
            },
            async onOffer(data) {
                // 接受并设置 远程 sdp
                await this.peer.setRemoteDescription(data.sdp)
                // 接收端创建answer
                let answer = await this.peer.createAnswer()
                //设置本地 answer sdp 信息
                this.peer.setLocalDescription(answer)
                // 给对方发送 answer
                socket.emit('1v1answer', {account: data.self, self: this.account, sdp: answer});
            },
            async onAnswer(data) {
                //呼叫端设置远程 answer 描述
                await this.peer.setRemoteDescription(data.sdp)
            },
            /**
             * 创建并发送 offer sdp
             * sdp 是一个描述多媒体连接内容的协议，例如分辨率，格式，编码，加密算法等
             * */
            async createOffer(data) {
                let offer = await this.peer.createOffer(this.offerOption)
                await this.peer.setLocalDescription(offer)
                // 给对方发送 offer
                socket.emit('1v1offer', {account: data.self, self: this.account, sdp: offer});
            },
            hangup() { // 挂断通话
                socket.emit('1v1hangup', {account: this.isCall, self: this.account});
                this.peer.close();
                this.peer = null;
                this.isToPeer = false;
                this.isCall = false;
                this.receiveTextArr = []
            },
            clearAll() {
                socket.emit('clearAll', {roomid: this.roomid, account: this.account})
            },
            send() {
                this.receiveTextArr.push({name:this.account,text:this.sendText})
                this.channelB.send(JSON.stringify({self:this.account,name: this.sendText}));
                this.sendText = '';
            },
            ceshi1() {
                socket.emit('ceshi1', {account: this.account, text: '测试内容'})
            }
        }
    }
</script>

<style scoped lang="less">
    .main {
        /*height: 500px;*/
        display: flex;
        border: 1px solid #eeeeee;
        padding: 10px;
        .list {
            padding: 0 10px;
            border-right: 1px solid black;
            .personbox {
                border: 1px solid #eee;
                padding: 5px;
                margin: 10px 5px;
            }
        }
        .right {

        }
    }

    video {
        margin: 10px;
        width: 30vw;
    }
</style>