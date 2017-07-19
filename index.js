const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

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
// update friendsCharts and allCharts when vote
exports.updateChartsWhenVote = functions.database.ref(`/users/{userUid}/userCharts/{chartKey}/chartData`)
                              .onWrite(event => {
                                    const userUid = event.params.userUid;
                                    const chartKey = event.params.chartKey;
                                    const chartData = event.data.val();
                                    let userFriends =[];
                                    if(chartData !== null){
                                        const voteCount = -1*chartData.reduce((a,b) => {return a+b})
                                        admin.database().ref(`allCharts/${chartKey}/chartData`).set(chartData)
                                        admin.database().ref(`allCharts/${chartKey}/voteCount`).set(voteCount)
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
// update friendsCharts and allCharts when user add chart or delete
exports.updateFriendsCharts = functions.database.ref(`/users/{userUid}/userCharts/{chartKey}/createdAt`)
                              .onWrite(event => {
                                    const userUid = event.params.userUid;
                                    const chartKey = event.params.chartKey;
                                    let userFriends =[];
                                    admin.database().ref(`/users/${userUid}/userCharts/${chartKey}`).once('value')
                                            .then(chartToAdd => {
                                                admin.database().ref(`allCharts/${chartKey}`).set(chartToAdd.val())
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
                             return admin.database().ref(`/users/${friendFireUid}/userCharts`).once('value')
                             .then(friendCharts => {
                                 admin.database().ref(`users/${userUid}/friendsCharts`).update(friendCharts.val())
                             })
                         })
// update loveCount in allCharts and friendsCharts
exports.updateChartsWhenLove = functions.database.ref(`/users/{userUid}/userCharts/{chartKey}/loveCount`)
                              .onWrite(event => {
                                    const userUid = event.params.userUid;
                                    const chartKey = event.params.chartKey;
                                    const loveCount = event.data.val();
                                    let userFriends =[];
                                    if(loveCount !== null){
                                        admin.database().ref(`allCharts/${chartKey}/loveCount`).set(loveCount)
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
                                         const chartkey = event.params.chartkey
                                         // Exit when the data is deleted.
                                        if (!event.data.exists()) {
                                            return;
                                        }
                                         admin.database().ref(`/users/${useruid}/userInfo/deviceToken`).once('value')
                                         .then(token=>{
                                             admin.database().ref(`users/${voteruid}/userInfo`).once('value')
                                             .then(userInfo => {
                                                var payload ={
                                                "notification":{
                                                "title":"Vote4Fun",
                                                "body":userInfo.val().name+" vote to your chart",
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

