# webrtc 例子

## 说明
1. server.js
自己写的 node 服务后台，需要启动
2. webrtc-demo\src\utils\socket.js  
sock连接，里面有连接地址，可以改
3. views/remote.vue 
远程连接的demo
4. views/some.vue
多人连接的例子 

##启动

1. 启动node服务,node server.js
2. 启动项目, npm run serve 
3. 进入

## 配置
如果不是启动在 https 下，需要配置浏览器调用摄像头

chrome://flags/#unsafely-treat-insecure-origin-as-secure