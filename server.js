const http = require('http');
const {SocketServer} = require('./WSS');
const { ClientList } = require('./ClientList');
const {validate} = require('./Authentication')

const server = http.createServer((req, res)=>{
    console.log(req);
})

server.listen(8080, '127.0.0.1', ()=>{
    console.info(`Server listening on ${server.address().port}`)
});

server.on('upgrade', (req, socket, head) => {

    //check if IP is already in connected clients list
    if(ClientList.list.has(socket.address().address)){
        socket.destroy();
    }
    
    //Authenticate the toke in Authorization header and initalize socket if the token is valid
    validate(req, socket, head, initSocket)

    


  });

server.on('error', (err)=>{
    console.error(err.message, err.stack);
})

const initSocket = (req, socket, head)=>{
    const ss = new SocketServer(socket);
    socket.on('data',(data)=>{
        ss.read(data);
    });
    ss.handleUpgrade(req,socket, head)
    ss.send({
        sender :"server",
        receiver: req.USER_NAME,
        message: "Hello from the server"
    });
    //ss.ping();
}


