const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true})
const gcs = require('@google-cloud/storage')()
admin.initializeApp(functions.config().firebase);
const request = require('request-promise');

exports.updateFirebaseUidInFriendsList = functions.database.ref('/users/{userUid}/friendsList/{index}/facebookUid')
                                         .onWrite(event => {
                                             // Exit when the data is deleted.
                                             if (!event.data.exists()) {
                                                 return;
                                             }
                                             const index = event.params.index
                                             const userUid = event.params.userUid
                                             const friendFacebookUid = event.data.val()
                                             return admin.database().ref(`/facebookUidVsFirebaseUid/${friendFacebookUid}`).once('value')
                                             .then(firebaseUid => {
                                                 admin.database().ref(`users/${userUid}/friendsList/${index}/firebaseUid`).set(firebaseUid.val())
                                                 // update friends chart
                                                .then(res => {
                                                    admin.database().ref(`users/${firebaseUid.val()}/userCharts`).once('value')
                                                    .then(friendCharts => {
                                                        admin.database().ref(`users/${userUid}/friendsCharts`).update(friendCharts.val())
                                                    })
                                                })
                                                 admin.database().ref(`users/${firebaseUid.val()}/friendsList`).once('value')
                                                 .then(friends => {
                                                     friends.forEach(friend => {
                                                         admin.database().ref(`users/${userUid}/userInfo/facebookUid`).once('value')
                                                         .then(userFacebookUid => {
                                                             if(userFacebookUid.val() === friend.val().facebookUid){
                                                                 admin.database().ref(`users/${firebaseUid.val()}/friendsList/${friend.key}/firebaseUid`)
                                                                 .set(userUid)
                                                             }
                                                         })
                                                     })
                                                 })
                                             })
                                         })
// update friendsCharts and publicCharts when vote and store voters
exports.updateChartsWhenVote = functions.database.ref(`/users/{userUid}/userCharts/{chartKey}/chartData`)
                              .onWrite(event => {
                                    const userUid = event.params.userUid;
                                    const chartKey = event.params.chartKey;
                                    const chartData = event.data.val();
                                    const voterUid = event.auth.variable ? event.auth.variable.uid : null;
                                    let userFriends =[];
                                    if(chartData !== null){
                                        const voteCount = -1*chartData.reduce((a,b) => {return a+b})
                                        admin.database().ref(`users/${userUid}/userCharts/${chartKey}/isPublic`).once('value')
                                        .then(isP => {
                                            if(isP.val() === "true"){
                                                admin.database().ref(`publicCharts/${chartKey}/chartData`).set(chartData)
                                                admin.database().ref(`publicCharts/${chartKey}/voteCount`).set(voteCount)                                                
                                            }
                                        })
                                        return admin.database().ref(`users/${userUid}/friendsList`).once('value')
                                        .then(friends => {
                                            friends.forEach(friend => {
                                                userFriends.push(friend.val().firebaseUid);
                                            })
                                            for(let f of userFriends){
                                                admin.database().ref(`users/${f}/friendsCharts/${chartKey}/chartData`).set(chartData)
                                                admin.database().ref(`users/${f}/friendsCharts/${chartKey}/voteCount`).set(voteCount)
                                            }
                                        })
                                    }
                              })
// update friendsCharts and publicCharts when user add chart or delete
exports.updateFriendsCharts = functions.database.ref(`/users/{userUid}/userCharts/{chartKey}/createdAt`)
                              .onWrite(event => {
                                    const userUid = event.params.userUid;
                                    const chartKey = event.params.chartKey;
                                    let userFriends =[];
                                    admin.database().ref(`/users/${userUid}/userCharts/${chartKey}`).once('value')
                                            .then(chartToAdd => {
                                                if(chartToAdd.val() && chartToAdd.val().isPublic === "false")
                                                    return
                                                admin.database().ref(`publicCharts/${chartKey}`).set(chartToAdd.val())
                                    })
                                    return admin.database().ref(`users/${userUid}/friendsList`).once('value')
                                    .then(friends => {
                                        friends.forEach(friend => {
                                            userFriends.push(friend.val().firebaseUid);
                                        })
                                        for(let f of userFriends){
                                            admin.database().ref(`/users/${userUid}/userCharts/${chartKey}`).once('value')
                                            .then(chartToAdd => {
                                                admin.database().ref(`users/${f}/friendsCharts/${chartKey}`).set(chartToAdd.val())
                                            })
                                        }
                                    })
                              })
exports.newFriendAdded = functions.database.ref('/users/{userUid}/friendsList/{index}/firebaseUid')
                         .onWrite(event => {
                             const userUid = event.params.userUid;
                             const friendFireUid = event.data.val()
                             if(friendFireUid)
                                admin.database().ref(`users/${userUid}/friendsFireUid/${friendFireUid}`).set(true)
                             return admin.database().ref(`/users/${friendFireUid}/userCharts`).once('value')
                             .then(friendCharts => {
                                 admin.database().ref(`users/${userUid}/friendsCharts`).update(friendCharts.val())
                             })
                         })
// update loveCount in publicCharts and friendsCharts
exports.updateChartsWhenLove = functions.database.ref(`/users/{userUid}/userCharts/{chartKey}/loveCount`)
                              .onWrite(event => {
                                    const userUid = event.params.userUid;
                                    const chartKey = event.params.chartKey;
                                    const loveCount = event.data.val();
                                    let userFriends =[];
                                    if(loveCount !== null){
                                        admin.database().ref(`users/${userUid}/userCharts/${chartKey}/isPublic`).once('value')
                                        .then(isP => {
                                            if(isP.val() === "true"){
                                                admin.database().ref(`publicCharts/${chartKey}/loveCount`).set(loveCount)                                                 
                                            }
                                        })
                                        return admin.database().ref(`users/${userUid}/friendsList`).once('value')
                                        .then(friends => {
                                            friends.forEach(friend => {
                                                userFriends.push(friend.val().firebaseUid);
                                            })
                                            for(let f of userFriends){
                                                admin.database().ref(`users/${f}/friendsCharts/${chartKey}/loveCount`).set(loveCount)
                                            }
                                        })
                                    }
                              })
// send push notification
exports.sendPush = functions.database.ref('/users/{useruid}/userCharts/{chartKey}/voters/{voteruid}')
                                     .onWrite(event => {
                                         const voteruid = event.params.voteruid
                                         const useruid = event.params.useruid
                                         const chartKey = event.params.chartKey
                                         // Exit when the data is deleted. OR the user vote to his chart
                                        if (!event.data.exists() || voteruid===useruid) {
                                            return;
                                        }
                                         admin.database().ref(`/users/${useruid}/deviceToken`).once('value')
                                         .then(token=>{
                                             admin.database().ref(`users/${voteruid}/userInfo`).once('value')
                                             .then(userInfo => {
                                                 admin.database().ref(`users/${useruid}/userCharts/${chartKey}/chartTitle`).once('value')
                                                 .then(chartName => {
                                                        var payload ={
                                                "notification":{
                                                    "title":"Vote4Fun",
                                                    "body":userInfo.val().name+" vote to "+chartName.val(),
                                                    "sound":"default",
                                                        }
                                                    }
                                                    return admin.messaging().sendToDevice(token.val(),payload)
                                                    .then(res => {
                                                        console.log('notification sended');
                                                    })
                                                    .catch(err => {
                                                        console.log(err)
                                                    })
                                                 })
                                             })
                                         })
                                     })
exports.storeChart = functions.https.onRequest((req,res) => {
    cors(req, res, () => {
    const chartDetails = req.body
    isArray = Array.isArray(chartDetails.chartData)
    isLength4 = (chartDetails.chartData.length == 4)
    isNumberAndZero = true;
    isFollowerCountIsZero = (chartDetails.followerCount == 0)
    for(n of chartDetails.chartData){
        if(n!==0){
            isNumberAndZero = false;
        }
    }
    isVoteCountZero = (chartDetails.voteCount == 0)
    if(chartDetails.voters!==undefined || !isArray || !isLength4 || !isNumberAndZero || !isVoteCountZero || !isFollowerCountIsZero){
        res.status(401).send('writing denied')
        return;
    }
    const tokenId = req.get('Authorization').split('Bearer ')[1];
    return admin.auth().verifyIdToken(tokenId)
      .then((decoded) => {
          var useruid = decoded.uid;
          if(chartDetails.owner !== useruid){
              res.status(401).send('writing denied')
              return;
          }
          admin.database().ref(`users/${useruid}/userCharts`).once('value').then(
              chartsSnap => {
                  if(chartsSnap.val())
                    return Object.keys(chartsSnap.val()).length < 4
                  return true
              }
          ).then(
            isUnderLimit => {
                if(isUnderLimit){
                    var key = admin.database().ref(`users/${useruid}/userCharts`).push(chartDetails).then(
                        chart => {
                            res.status(200).send(chart.key)
                        }
                    )
                }else{
                    res.status(403).send('write denied by chart limit')
                }
            }
          )
        })
      .catch((err) => res.status(402).send('permission denied'));
  });
})

exports.voteFor = functions.https.onRequest((req,res)=>{
        cors(req, res, () => {
            const tokenId = req.get('Authorization').split('Bearer ')[1];
            return admin.auth().verifyIdToken(tokenId)
            .then((decoded) => {
                var useruid = decoded.uid;
                const key = req.query.key
                const owner = req.query.owner
                const index = req.query.index
                admin.database().ref(`users/${owner}/userCharts/${key}/voters/${useruid}`).once('value')
                .then(
                    voters => {
                        if(voters.val()){
                            res.status(401).send('you are already voted')
                        }else{
                                admin.database().ref(`users/${owner}/userCharts/${key}/voteCount`).ref.transaction(
                                currentValue =>{
                                    currentValue--
                                    return currentValue
                                    }
                                )
                                admin.database().ref(`users/${owner}/userCharts/${key}/voters/${useruid}`).set(true)
                                admin.database().ref(`users/${owner}/userCharts/${key}/chartData/${index}`).ref.transaction(
                                currentValue =>{
                                    currentValue++
                                    return currentValue
                                }
                            )
                            res.status(200).send('voted successfully')
                        }
                    }
                )
            })
            .catch((err) => res.status(402).send('permission denied'));
        });
})

exports.deleteChart = functions.https.onRequest((req,res)=>{
        cors(req, res, () => {
            const tokenId = req.get('Authorization').split('Bearer ')[1];
            return admin.auth().verifyIdToken(tokenId)
            .then((decoded) => {
                var useruid = decoded.uid;
                const key = req.query.key
                admin.database().ref(`users/${useruid}/userCharts/${key}`).once('value')
                .then(chart => {
                    return chart.val().owner === useruid
                })
                .then(isOwner => {
                    if(!isOwner){
                        res.status(401).send('you are not the owner for this chart, so you cannot delete it')
                    }else{
                        admin.database().ref(`users/${useruid}/userCharts/${key}/followers`).once('value')
                        .then(followers => {
                            if(followers.val()){
                                for(f in followers.val()){
                                    admin.database().ref(`users/${f}/follow/${key}`).set(null)
                                }
                                admin.database().ref(`users/${useruid}/userCharts/${key}`).remove()
                            }else{
                                admin.database().ref(`users/${useruid}/userCharts/${key}`).remove()
                            }
                        })
                        res.status(200).send('deleted successfully')
                    }
                })
            })
            .catch((err) => res.status(402).send('permission denied'));
        });
})
exports.followChart = functions.https.onRequest((req,res)=>{
        cors(req, res, () => {
            const tokenId = req.get('Authorization').split('Bearer ')[1];
            return admin.auth().verifyIdToken(tokenId)
            .then((decoded) => {
                var useruid = decoded.uid;
                const key = req.query.key
                const owner = req.query.owner
                admin.database().ref(`users/${useruid}/follow/${key}`).once('value')
                .then(
                    followers => {
                                let toFollow = followers.val() ? null : true
                                let message = "follow"
                                admin.database().ref(`users/${owner}/userCharts/${key}/followerCount`).ref.transaction(
                                currentValue =>{
                                    if(toFollow){
                                        currentValue--
                                    }
                                    else{
                                        currentValue++
                                        message = "unfollow"
                                    }
                                    return currentValue
                                    }
                                )
                                admin.database().ref(`users/${owner}/userCharts/${key}/followers/${useruid}`).set(toFollow)
                                admin.database().ref(`users/${useruid}/follow/${key}`).set(toFollow)
                            res.status(200).send(message+' successfully')
                        }
                )
            })
            .catch((err) => res.status(402).send('permission denied'));
        });
})
exports.limitUploadToStorage = functions.storage.object().onChange(event => {
    const object = event.data; // The Storage object.
    const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
    // Exit if this is a move or deletion event.
    if (resourceState === 'not_exists') {
        console.log('This is a deletion event.');
        return;
    }
    const fileBucket = object.bucket;
    const bucket = gcs.bucket(fileBucket);
    const filePath = object.name;
    const folderPath = filePath.substring(0,filePath.lastIndexOf('/'))
    const file = bucket.file(filePath)
    bucket.getFiles({
        prefix: folderPath, //Path like what you use to get reference of your files in storage 
    }, (error, files) => {
        if(files.length>5){
            file.delete().then(()=>{
                console.log('uploading more than 4 images was rejected')
            })
        }
    });
    return
})

exports.getShortLink = functions.https.onRequest((req,res)=>{
        cors(req, res, () => {
            const tokenId = req.get('Authorization').split('Bearer ')[1];
            return admin.auth().verifyIdToken(tokenId)
            .then((decoded) => {
                const key = req.query.key
                if(typeof key !== 'string'){
                    res.status(401).send('called rejected')
                    return
                }
                let longUrl = "https://funvaotedata.firebaseapp.com/chart/"+key
                const googleShortenerKey = "AIzaSyB3Yywoi6F0ipDHYWEV7HCDEJGgKh84Irg";
                request({
                            method: 'POST',
                            uri: `https://www.googleapis.com/urlshortener/v1/url?key=${googleShortenerKey}`,
                            body: {
                            longUrl: longUrl
                            },
                            json: true,
                            resolveWithFullResponse: true
                        }).then(response => {
                            if (response.statusCode === 200) {
                                return response.body.id;
                            }
                            throw response.body;
                        }).then(shortUrl => {
                            res.status(200).send(shortUrl)
                        })
                
            })
            .catch((err) => res.status(402).send('permission denied'));
        });
})