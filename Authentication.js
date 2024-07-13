const jwt = require('jsonwebtoken');
const {config} = require('./config')

module.exports ={
    validate,
    //createToken
}


function validate(req, socket, head, initSocket){
    try {
        const query = getQUery(req);
        const token = query.token ? query.token : ""

        if(token == null){
            return [false]
        }
        jwt.verify(token,config.SECRET_KEY, (err,user)=>{
            if(err) {
                console.log(err);
                return
            }

            req.USER_NAME = user.unique_name;
            
            initSocket(req, socket, head);
        })
    } catch (error) {
        console.log(error);
        return [false]
        
    }
}

const getQUery = function(req){
    let q = req.url.split('?'),query={};
    if(q.length >= 2){
        q[1].split('&').forEach((item)=>{
             try {
               query[item.split('=')[0]]=item.split('=')[1];
             } catch (e) {
               query[item.split('=')[0]]='';
             }
        })
    }
    return query;
  }

// function createToken(params){
//     try {
//         const user ={
//             fname: params.fname,
//             lname: params.lname,
//             id: params.id
//         };
//         return jwt.sign({user}, "secret key")
//     } catch (error) {
//         console.log(error);
//         return null;
//     }
// }