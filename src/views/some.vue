<template>
    <div class="room">
        <div class="jianjie">
            <p>1.这是个多人视频的例子</p>
            <p>2.输入自己的用户名和密码进入房间</p>
            <p>3.现在所在的房间是：{{roomid}}</p>
        </div>
        <div class="top">

            <Input v-model="account" placeholder="用户名" style="width: 300px"/>
            <Input v-model="roomid" placeholder="房间号" style="width: 300px"/>
            <Button @click="join_func" :disabled="calling">加入房间</Button>
            <Button @click="leave_func">离开房间</Button>
            <Button @click="clearAll_func">清空房间</Button>
        </div>
        <div style="display: flex;justify-content: space-between">
            <div class="main-video">
                <div class="video-box" ref="video-box">
                    <p>我自己</p>
                    <video class="video-mine" autoplay controls ref="video-mine"></video>

                </div>
                <div style="display: flex;flex-wrap: wrap" id="videoId">
                    <div class="video-box" v-for="(s,si) in streamList">
                        <p>{{s.name}}</p>
                        <video class="video-other" autoplay controls></video>
                    </div>
                </div>
            </div>


            <div class="right">
                <p v-for="v in infoList">{{v.name}}：{{v.text}}</p>
                <p style="margin-top: 30px">现在房间我的连接的列表是：</p>
                <p>{{peerList}}</p>
                <p style="margin-top: 30px">现在房间里人的列表是：</p>
                <p style="font-size: 18px;font-weight: bold" v-for="(p,pi) in personInRoom">{{pi+1}}.{{p.account}}</p>

            </div>
        </div>

    </div>
</template>

<script>
    import socket from '@/utils/socket'

    export default {
        name: "some",
        data() {
            return {
                calling: false,
                account: '',
                roomid: 'a1',
                peer: null,
                peerList: {},
                candidate: null,
                localStream: null,
                streamList: [],
                infoList: [],
                personInRoom: []
            }
        },
        mounted() {
        },
        beforeDestroy() {
            console.log('开始销毁')
            this.leave_func()
        },
        methods: {
            getUserMedia() {
                //兼容浏览器的getUserMedia写法
                let myVideo = this.$refs['video-mine'];
                //获取本地的媒体流，并绑定到一个video标签上输出，并且发送这个媒体流给其他客户端
                return new Promise((resolve, reject) => {
                    navigator.mediaDevices.getUserMedia({audio: true, video: true}).then((stream) => {
                        //绑定本地媒体流到video标签用于输出
                        myVideo.srcObject = stream;
                        this.localStream = stream;
                        resolve();
                    }).catch((err) => {
                        console.log('调取摄像头异常');
                        console.log(err);
                        reject(err);
                    })
                })
            },
            join_func() {

                if (!this.account) {
                    return
                }
                this.getUserMedia().then(() => {
                    socket.emit('join', {roomid: this.roomid, account: this.account});
                }).catch(err => {
                    console.log('没掉漆摄像头')
                    socket.emit('join', {roomid: this.roomid, account: this.account});
                })
                this.socketInit();
                this.calling = true
            },
            socketInit() {
                socket.on('joined', (data, account) => {
                    console.log('有人加入')
                    this.addInfoList('有人加入,他是' + account)
                    console.log(data)
                    this.personInRoom = data
                    console.log(account)
                    if (data.length > 0) {
                        //如果除了自己还有其他人，就和他们循环 都建立一个通道
                        data.forEach(v => {
                            let obj = {}
                            let arr = [v.account, this.account];
                            obj.account = arr.sort().join('-');
                            if (!this.peerList[obj.account] && v.account !== this.account) {
                                // console.log('obj', obj);
                                this.getPeerConnection(obj);
                            }
                        })
                        //创建自己的sdp
                        if (account === this.account) {
                            // console.log('account', account);
                            for (let k in this.peerList) {
                                this.createOffer(k, this.peerList[k]);
                            }
                        }
                    }
                })
                socket.on('offer', v => {
                    // console.log('take_offer', this.peerList[v.account]);
                    this.peerList[v.account] && this.peerList[v.account].setRemoteDescription(v.sdp, () => {
                        this.peerList[v.account].createAnswer().then((desc) => {
                            // console.log('send-answer', desc);
                            this.peerList[v.account].setLocalDescription(desc, () => {
                                socket.emit('answer', {
                                    'sdp': this.peerList[v.account].localDescription,
                                    roomid: this.roomid,
                                    account: v.account
                                });
                            });
                        });
                    }, () => {// console.log(err)
                    });
                })
                socket.on('answer', v => {
                    console.log('take_answer', v.sdp);
                    this.peerList[v.account] && this.peerList[v.account].setRemoteDescription(v.sdp, function () {
                    }, () => {// console.log(err)
                    });
                })
                socket.on('__ice_candidate', v => {
                    // console.log('take_candidate', v.candidate);
                    //如果是一个ICE的候选，则将其加入到PeerConnection中
                    if (v.candidate) {
                        this.peerList[v.account] && this.peerList[v.account].addIceCandidate(v.candidate).catch(() => {
                            }// console.log('err', e)
                        )
                    }
                })
                socket.on('oneLeave', (room, data) => {
                    console.log('有人离开了');
                    console.log(data.account);
                    this.personInRoom = room
                    this.infoList.push('有人离开了' + data.account)
                    this.breakOne(data.account)
                });
                socket.on('clearAll', (data) => {
                    console.log('清空了了房间')
                    console.log(data)
                    this.leave_func()
                    this.personInRoom = []
                    this.infoList = []
                })
                socket.on('onclose', () => {
                    console.log('连接断开了');
                });
            },
            /**
             * 建立链接通道
             */
            getPeerConnection(v) {
                let self = this
                let videoBox = this.$refs['video-box']
                let iceServer = {
                    "iceServers": [
                        {
                            "url": "stun:stun.l.google.com:19302"
                        }
                    ]
                }
                let PeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection
                let peer = new PeerConnection(iceServer)

                if (this.localStream) {
                    console.log('添加本地流')
                    peer.addStream(this.localStream)
                } else {
                    console.log('没有添加本地流')
                }


                //创建一个 点对点的 连接通道的 对象
                this.peerList[v.account] = peer
                //把自己的 icecandidate 传给其他人
                peer.onicecandidate = (e => {
                    if (e.candidate) {
                        socket.emit('__ice_candidate', {
                            'candidate': e.candidate,
                            roomid: this.roomid,
                            account: v.account
                        })
                    }
                })

                //如果检测到媒体流连接到本地，将其绑定到一个video标签上输出

                peer.onaddstream = function (event) {
                    // console.log('event-stream', event);
                    self.addInfoList(`我接受到了${v.account}的流`)
                    // let videos = document.querySelector('#' + v.account);
                    // if (videos) {
                    //     videos.srcObject = event.stream;
                    // } else {
                    //     let video = document.createElement('video');
                    //     video.controls = true;
                    //     video.autoplay = 'autoplay';
                    //     video.srcObject = event.stream;
                    //     video.id = v.account;
                    //     videoBox.append(video);
                    // }
                    let nodes = document.getElementById("videoId").getElementsByTagName("video")
                    console.log('获取节点')
                    console.log(nodes)
                    self.streamList.push({name: v.account, stream: event.stream})

                    self.$nextTick(() => {
                        nodes.forEach((n, ni) => {
                            n.srcObject = self.streamList[ni].stream
                        })
                    })
                    // streamList
                }
                peer.onremovestream = (e => {
                    console.log('是收到removestream 事件时调用的事件处理器，当一条MediaStream 从连接上移除时，该事件被触发。')
                })
            },
            createOffer(account, peer) {
                //发送offer，发送本地session描述
                peer.createOffer({
                    offerToReceiveAudio: 1,
                    offerToReceiveVideo: 1
                }).then((desc) => {
                    // console.log('send-offer', desc);
                    peer.setLocalDescription(desc, () => {
                        socket.emit('offer', {'sdp': peer.localDescription, roomid: this.roomid, account: account});
                    });
                });
            },
            breakOne(name) {
                //和 这个人断开连接
                console.log(`和 这个人 ${name} 断开连接`)
                let arr = [name, this.account];
                let account = arr.sort().join('-');
                for (let k in this.peerList) {
                    if (k === account) {
                        if(this.peerList[k]){
                            this.peerList[k].close();
                            this.peerList[k] = null;
                        }
                    }
                }
                this.streamList.forEach((v, i) => {
                    if (v.name === account) {
                        this.streamList.splice(i, 1)
                    }
                })
            },
            leave_func() {
                console.log(this.peerList)
                for (let k in this.peerList) {
                    if(this.peerList[k]){
                        this.peerList[k].close();
                        this.peerList[k] = null
                    }
                }
                this.peerList = []
                this.streamList = []
                this.calling = false
                socket.emit('oneLeave', {roomid: this.roomid, account: this.account});
                console.log(this.peerList)
            },
            clearAll_func(){
                socket.emit('clearAll', {roomid: this.roomid, account: this.account});
            },
            addInfoList(text) {
                this.infoList.push({name: this.account, text: text})
            }
        }
    }
</script>

<style scoped lang="less">
    .room {
        padding: 30px;
        .top {
            margin: 0 0 30px 0;
        }
    }

    .right {
        width: 30%;
        border-left: 2px solid black;
    }

    .main-video {
        display: flex;
    }

    .video-box {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        flex-wrap: wrap;
        p {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
        }
    }

</style>
<style>
    video {
        width: 300px;
        height: 300px;
        margin: 20px 15px;
    }
</style>
