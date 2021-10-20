import io from 'socket.io-client'
// let host = 'http://192.168.1.101:3002'
let host = 'http://172.16.0.108:3002'
const socket  = io.connect(host)
export default socket
