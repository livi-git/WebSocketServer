'use strict';
const {createHash} =  require('crypto')
const {Buffer} = require('buffer');
const EventEmitter = require('events');
const {ClientList} = require('./ClientList');


class SocketServer{
    socket = null;
    readFinalFrame= true;
    clientMessageBuffer = null;

    constructor(socket){
        this.socket = socket
        this.socket.on('close',()=>{
            console.warn("socket successfully disconnected")
        })
    }

    handleUpgrade (req, socket, buff) { 
            /*
        handle the incoming request:
        1. get the Sec-WebSocket-Key
        2. create hash from the key using sha1 algorithm
        3. send the hash inthe handshake response
        4. replace old event listeners
        5. initialize socket
        */

        //get the Sec-WebSocket-Key
        const clientKey = req.headers['sec-websocket-key'];

        //create hash from the key using sha1 algorithm
        const hash = createHash('sha1').update(clientKey+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest('base64');
        
        //send the hash inthe handshake response
        const headers = [
            'HTTP/1.1 101 Web Socket Protocol Handshake',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${hash}`
        ];

        this.socket.write(headers.concat('\r\n').join('\r\n'));

        //add the username and respective socket to the list
        ClientList.list.set(req.USER_NAME, this.socket);
        console.log(ClientList);



    }

    send(data){
        /*
            send the data frame to client 

            1. find bytelength of the data to be sent
            2. set up fin, rsvp, opcode,  Mask byte, payload legth , Mask key, payload data
            3. write the data frame into the socket
        */ 

        // number of bytes to be added before payload (fin,rsvp1 ,rsvp2, rsvp3, opcode)1 Byte, (mask, payload length)1 Byte
        //default 2 and extended based on payload length nad mask
        let offset =2;

        // find bytelength of the data to be sent
        let dataLength = Buffer.byteLength(JSON.stringify(data));;

        let payloadLength = dataLength;

        // 65535 is the largest number represented by 2 byte
        // id data length is larger than 65535 we need to allocate next 8 byte to represent data length and change payload length to 128 to indicate the appended bytes
        // 2nd byte(mask(1 bit)+ payloadlength(7 bit))
        // if the 7 bits that represent length is greater than 125 then need to add append next 2 byes and change payload length to 126 to indicate the appended bytes
        if(dataLength >  65535){
            offset +=  8;
            payloadLength = 127;

        }else if(dataLength > 125){
            offset += 2;
            payloadLength = 126;
        }

        // create the buffer with offset length. you can append buffer created from data using Buffer.concat metod
        // or you can send send frame buffer and send data buffer after that  
        const buffer = Buffer.alloc(offset);

        buffer[0] = 129;
        buffer[1] = payloadLength;

        // if payload length is 126 then the data length is added in the 3rd and 4th byte
        // if payload length is 127 then the data length is added from the 5th byte as writeUInt16BE can precisely write only 6 byte
        if(payloadLength === 126){
            buffer.writeUInt16BE(dataLength, 2);
        }else if(payloadLength ===127){
            buffer[2] = buffer[3] =0;
            buffer.writeUInt16BE(dataLength,4,6);
        }

        this.sendMessage(buffer, data, false);

    }

    read(buffer){

        /*
            Read the message frame from the client and unmask it

            1. Read the message and check the fin , mask bit, payload Length
            2. If fin bit is not set 1 need to combine the oncoming frames with continuation opcode until fin bit frame is recieved
            3. Get the 4Byte Mask and unmask using XOR operation
        */
       try {
        let dataLength = 0;
        let dataOffset = 0;
        const maskBytes = new Array(4);
        // console.log(buffer);

        // find fin bit, if fin bot is 0 set readFinalFrame to false
        const finBit = buffer[0]>>>7;
        console.log("fin :"+finBit);
        if(finBit !== 1){
            this.readFinalFrame = false;
        }else{
            this.readFinalFrame = true;
        }

        // find the opcode to see what kind of frame it is
        const opCode = buffer[0] & 0x0F
        console.log("opcode :"+opCode);

        //send pong if it is ping frame 0x9
        if(opCode === 9){
            console.log("ping recieved. Sending Pong");
            this.pong();
        }else if(opCode === 8){// opcode 0x8 indicates the close frame
            console.warn(this.socket.address().address+" initialized disconnection process...");
            ClientList.list.delete(this.socket.address().address);
            this.socket.destroy();
            return
        }


        // check if Mask bit is et to 1
        const mask = buffer[1]>>>7;
        console.log("mask :"+mask);

        //find payload length
        //if payload length is 0 the return as it is unneccesary to find mask and unmask as no data available
        //if length is less than 126 then that is the data length
        //if length is 126 then the take next 2 byte for datalegth
        //if length is 127 then the take next 8 byte for datalegth
        const payloadLength =  buffer[1] & 0x7F //0x7f = 01111111
        console.log("payloadlength :"+payloadLength)
        if(payloadLength == 0){
            return
        }else if(payloadLength < 126){

            dataLength = payloadLength

        }else if(payloadLength === 126){

            dataLength = buffer.readUInt16BE(2);

        }else if(payloadLength === 127){

            dataLength = Number(buffer.readBigUInt64BE(2));

        }

        //get mask bytes
        if(mask === 1){
            if(payloadLength < 126){

                maskBytes[0] = buffer[2];
                maskBytes[1] = buffer[3];
                maskBytes[2] = buffer[4];
                maskBytes[3] = buffer[5];
                dataOffset = 6;
    
            }else if(payloadLength === 126){
    
                maskBytes[0] = buffer[4];
                maskBytes[1] = buffer[5];
                maskBytes[2] = buffer[6];
                maskBytes[3] = buffer[7];
                dataOffset = 8;

    
            }else if(payloadLength === 127){
    
                maskBytes[0] = buffer[10];
                maskBytes[1] = buffer[11];
                maskBytes[2] = buffer[12];
                maskBytes[3] = buffer[13];
                dataOffset = 14;
    
            }
        }

        //unmask the data and add it in the clientMessageBuffer 
        if(this.clientMessageBuffer === null){

            this.clientMessageBuffer = this.unmask(maskBytes, buffer, dataLength, dataOffset)[0];

        }else{
            const list = this.unmask(maskBytes, buffer, dataLength, dataOffset)[0];
            const dBuffer = list[0];
            const dLength = list[1];
            this.clientMessageBuffer = this.clientMessageBuffer.concat([this.clientMessageBuffer, dBuffer], (this.clientMessageBuffer.length + dLength));

        }

        //if the frame is the final frame the console the unmasked message from the clientMessageBuffer
        //and set it null
        if(this.readFinalFrame){
            // console.log(JSON.parse(this.clientMessageBuffer.toString()));

            const data = JSON.parse( this.clientMessageBuffer.toString() );
            
            if(!this.validateDTOFormat(data)) return;

            this.send(data)


            this.clientMessageBuffer.fill(0);
            this.clientMessageBuffer = null;
        
        }

       } catch (error) {
         console.error(error)
       }
        

    }

    validateDTOFormat(data){
        /*
            validate if the data is the type of object
            validate data has the property of sender, reciever, message
            validate sender, reciever fields are not null, undefined or empty
        */
            try {
                    if(typeof(data) != 'object') throw Error("Object is not of type string");
                
                    const keys = Object.keys(data);
                
                    if(keys.length < 3 || keys.length > 3) throw Error("Object contains more/less the 3 properties");
                    
                    if(keys.indexOf("sender") === -1 || keys.indexOf("receiver") === -1 || keys.indexOf("message") === -1)  throw Error("Object is missing 1 or more properies");
                    if(typeof(data['sender']) != "string" || data['sender'] ===""
                    || typeof(data['receiver']) != "string" || data['receiver'] ===""
                    || typeof(data['message']) != "string")  throw Error("Sender, receiver, message properties not the type of string or contains null/empty"); 
                
                    return true;
                } catch (error) {
                    console.error(error);
                    return false;
                }
    }

    unmask(mask, buffer ,datalegth, dataOffset){
        let maskPointer = 0;
        const dataBuffer = Buffer.allocUnsafe(datalegth);

        for(let i = dataOffset; i< datalegth+dataOffset; i++){

            //change maskPointer to 0 if it exceeds 3
            if(maskPointer > 3) maskPointer = 0;

            //perform XOR to unmask
            dataBuffer[i-dataOffset] = mask[maskPointer] ^ buffer[i];

            maskPointer++;

        }

        return [dataBuffer, dataBuffer.length];


    }

    ping(){
        const pingBUffer = Buffer.allocUnsafe(2);
        pingBUffer[0] =  137;
        pingBUffer[1] = 0;
        this.sendMessage(pingBUffer, null, true)

    }

    pong(){
        const pongBuffer = Buffer.allocUnsafe(2);
        pongBuffer[0] = 138;
        pongBuffer[1] = 0;
        this.sendMessage(pongBuffer, null, true);
    }

    sendMessage(header, data, controlFrame){
        try {
            let sock = null;

            //if sending control frames like ping and pong then use the same socket 
            //otherwise use the respective client socket
            if(controlFrame){
                sock = this.socket
            }else{
                sock = ClientList.list.get(data.receiver);
            }
        
            // cork is used to load data into the buffer after uncork data is flushed from buffer
            sock.cork();
            sock.write(header);
            
            //if data is null send header bits alone ex:ping, pong, close
            if(data !== null && data !== undefined) sock.write(JSON.stringify(data))

            sock.uncork();
        } catch (error) {
            console.error("Receiver is not connected to the server!")
        }
        
    }

    

}




module.exports={
    SocketServer
}