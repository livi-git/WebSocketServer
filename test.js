const {Buffer} = require('buffer');
const {validate} = require('./Authentication')

function getDatalengthFrom2Bytes(buffer){
    /*
       Check if the first Byte is 0, if so then the secondd byte contains the data length
       if not zero the perfom 8 bit right shift on the first byte then add the second byte
    */
//    if(buffer[2]===0){
//         return buffer[2]
//    }else{
        return buffer.readUInt16BE(2)
        //return ((buffer[0]<<8) + buffer[1])
//    }

}
function getDatalengthFrom8Bytes(buffer){
    /*
        loop through the 8 bytes until you reach non zero byte
        counter starts from 2 (first payload length length byte = buffer[2])
        counter ends at 9 (last payload length length byte = buffer[9])
        Find the number of shifts needs to be done by subtracting counter value on non zero byte from 9
        Add the byte values until counter reach 9th byte
    */
        return buffer.readBigUInt64BE(2)
        // let counter = 2;
        // let data =BigInt(0);

        // while(counter <=9){
        //     if(buffer[counter] !== 0){
        //         data += BigInt( ( buffer[counter] << ( ( 9 - counter ) * 8 ) ) )
        //     }
        //     counter++
        // }

        // return data;
        
}


//const buffer = Buffer.alloc(12);
// buffer[0] = 1;
// buffer[1] = 1;
// buffer[2] = 0;
// buffer[3] = 0;
// buffer[4] = 0;
// buffer[5] = 0;
// buffer[6] = 0;
// buffer[7] = 0;
// buffer[8] = 240;
// buffer[9] = 240;
// buffer[10] = 1;
// buffer[11] = 1;
// const res = getDatalengthFrom8Bytes(buffer)
// console.log(res)


// const res =  validate("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImxpdmkiLCJuYmYiOjE3MTczNDM1MjksImV4cCI6MTcxNzQyOTkyOSwiaWF0IjoxNzE3MzQzNTI5fQ.DxVmYNKqB9fjLbxLVg9P88ksu4eIMsPwP5gQP2hvnSg");

// console.log(res);
validateDTOFormat = (data)=>{
    /*
        validate if the data is the type of object
        validate data has the property of sender, reciever, message
        validate sender, reciever fields are not null, undefined or empty
    */
   try {
    if(typeof(data) != 'object') return false;

    const keys = Object.keys(data);
    console.log(keys);

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
const data ={
    sender : "livi",
    receiver: "livi",
    message: "",
    
}
console.log(validateDTOFormat(data));
console.log("added test branch")

