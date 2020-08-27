<template>
    <div>
        <div>
            <button @click="createMedia">开摄像头</button>
            <button @click="call">建立链接</button>
            <button @click="hangup">挂断</button>
        </div>
        <div>
            <video src="" id="rtcA" controls autoplay class=""></video>
            <video src="" id="rtcB" controls autoplay class=""></video>
        </div>
        <div>
            <div>
                <h5>收消息</h5>
                <p>{{receiveText}}</p>
            </div>
            <div>
                <h5>发消息</h5>
                <textarea v-model="sendText"></textarea>
                <br>
                <button @click="send">发送</button>
            </div>
        </div>

    </div>
</template>

<script>
    export default {
        name: "local",
        data() {
            return {
                localstream: null,
                peerA: null,
                peerB: null,
                answerA: null,
                offerB: null,
                offerOption: {
                    /**
                     * 要在活动连接上重新启动ICE，请将其设置为true。
                     * 这将导致返回的 offer 与已经存在的凭证不同。
                     * 如果您应用返回的offer，则ICE将重新启动。
                     * 指定false以保留相同的凭据，因此不重新启动ICE。
                     * 默认值为false。
                     */
                    iceRestart: false,
                    offerToReceiveAudio: 1,
                    offerToReceiveVideo: 1
                },
                sendText: '',
                receiveText: ''
            }
        },
        mounted() {
        },
        methods: {
            async createMedia() {
                this.localstream = await navigator.mediaDevices.getUserMedia({audio: true, video: true})
                console.log('本地视频流')
                console.log(this.localstream)
                let video = document.getElementById('rtcA');
                video.srcObject = this.localstream

                this.initPeer(); // 获取到媒体流后，调用函数初始化 RTCPeerConnection
            },
            initPeer() {
                /** 创建输出端 */
                /** 1.RTCPeerConnection 其代表在本地设备和远程服务器之间的连接。 */
                let peerConnection = window.RTCPeerConnection
                this.peerA = new peerConnection()
                /** 2.添加本地流 */
                this.peerA.addStream(this.localstream)
                /**
                 * 做媒体协商时会触发此事件
                 * 监听 A 的ICE候选信息
                 * 如果收集到，就添加给 B
                 * */
                this.peerA.onicecandidate = (e) => {
                    console.log('监听 A 的ICE候选信息')
                    console.log(e)
                    if (e.candidate) {
                        this.peerB.addIceCandidate(e.candidate)
                    }
                }
                /** 数据通道的处理，对视频没有影响 */
                this.peerA.ondatachannel = (event) => {
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
                        this.receiveText = JSON.parse(e.data).name
                        console.log('channelA onmessage', e.data)
                    };
                };

                /** 创建呼叫端 */
                this.peerB = new peerConnection()
                /** 监听是否有媒体流接入，如果有就赋值给 rtcB 的 src */
                this.peerB.onaddstream = (e) => {
                    console.log('peerB有媒体流接入')
                    console.log(e)
                    let video = document.getElementById('rtcB')
                    video.srcObject = e.stream
                }

                /** 监听 B 的ICE候选信息*/
                this.peerB.onicecandidate = (e) => {
                    console.log('监听 B 的ICE候选信息')
                    console.log(e)
                    if (e.candidate) {
                        this.peerA.addIceCandidate(e.candidate)
                    }
                }

                /** 创建一个可以发送任意数据的数据通道，对视频没有影响，不加一样 */
                this.channelB = this.peerB.createDataChannel('messagechannel')
                console.log('this.channelB', this.channelB);
                this.channelB.binaryType = 'arraybuffer'
                this.channelB.onopen = (event) => {
                    console.log('channelB onopen', event);
                    this.messageOpen = true;
                }
                this.channelB.onclose = function (event) {
                    console.log('channelB onclose', event)
                }

            },
            async call() {
                console.log('开始呼叫')
                console.log(this.peerA)
                console.log(this.peerB)
                if (!this.peerA || !this.peerB) { // 判断是否有对应实例，没有就重新创建
                    this.initPeer();
                }
                /**
                 * 启动创建一个SDP offer，目的是启动一个新的WebRTC去连接远程端点
                 * peerB 是呼叫端
                 * */
                try {
                    let offer = await  this.peerB.createOffer(this.offerOption)
                    await this.onCreateOffer(offer)
                } catch (e) {
                    console.log('createOffer: ', e);
                }

            },
            async onCreateOffer(desc) {
                await this.peerB.setLocalDescription(desc)
                await this.peerA.setRemoteDescription(desc)

                /** peerA 是接收端 */
                let answer = await this.peerA.createAnswer()
                await this.onCreateAnswer(answer)
            },
            async onCreateAnswer(desc) {
                await this.peerA.setLocalDescription(desc)

                await this.peerB.setRemoteDescription(desc)
            },
            send() {
                this.channelB.send(JSON.stringify({name: this.sendText}));
                this.sendText = '';
            },
            hangup() {
                this.peerA.close();
                this.peerB.close();
                this.channelA.close();
                this.channelB.close();
                this.peerA = null;
                this.peerB = null;
                this.channelA = null;
                this.channelB = null;
                this.sendText = '';
                this.receiveText = '';
            },
        }
    }
</script>

<style scoped lang="less">
    #rtcA {
        width: 400px;
        height: 300px;
    }

    #rtcB {
        width: 400px;
        height: 300px;
    }
</style>