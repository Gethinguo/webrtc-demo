import io from 'socket.io-client'
let host = 'http://192.168.1.101:3002'
const socket  = io.connect(host)
export default socket