const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// update friendsCharts When Chart Added Or Removed
exports.updatefriendsCharts = functions.database.ref('/allCharts/{keyId}')
                        .onWrite(event => {
                            const key = event.params.keyId
                            //remove chart from friends when the chart is deleted.
                            if (!event.data.exists() && event.data.previous.exists()) {
                                const oldChart = event.data.previous.val();
                                admin.database().ref(`/users/${oldChart.owner}/friendsList`).once('value', (friends) => {
                                if(friends.val()){
                                    friends.val().forEach((friend) => {
                                        if(friend.firebaseUid){
                                            admin.database().ref(`/users/${friend.firebaseUid}/friendsCharts/${key}`).set(null)   
                                        }
                                });
                            }
                            })
                                return;
                            }
                            const chart = event.data.val();
                            admin.database().ref(`/users/${chart.owner}/friendsList`).orderByValue().once('value', (friends) => {
                                if(friends.val()){
                                    friends.val().forEach((friend) => {
                                        if(friend.firebaseUid){
                                            admin.database().ref(`/users/${friend.firebaseUid}/friendsCharts/${key}`).set(chart)
                                        }  
                                });
                            }
                            })

                        })
exports.newUserRegister = functions.database.ref('/users/{userUid}/friendsList')
                          .onWrite(event => {
                              // Only edit data when it is first created.
                              if (event.data.previous.exists()) {
                                return;
                            }
                            const userUid = event.params.userUid;
                            //TODO save firebaseUid for my friends
                            admin.database().ref(`/users/${userUid}/friendsList`).once('value', userFriends => {
                                if(userFriends.val()){
                                    userFriends.val().forEach(friend => {
                                    admin.database().ref(`/users/${friend.firebaseUid}/userCharts`).once('value',friendsCharts => {
                                        if(friendsCharts.val()){
                                            friendsCharts.val().forEach(chart => {
                                            admin.database().ref(`/users/${userUid}/friendsCharts/${chart.key}`).set(chart.val())
                                        })}
                                    })
                                })}
                            }
                            )

                          })

