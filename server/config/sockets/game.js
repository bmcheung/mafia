module.exports = function(io, socket, rooms){
    function emitAliveDead(roomId){
        //CHANGE TO EMIT ALIVE AND DEAD
        var room = rooms[roomId];
        var users = room.users;
        var players = [];
        for(var i=0; i < users.length; i++){
            if(users[i].alive){
                players.push(users[i].name);
            }
        }
        for(var i=0; i < users.length; i++){
            if(io.sockets.connected[users[i].socketID]){
                io.sockets.connected[users[i].socketID].emit('players_sent', {players: players, aliveList: rooms[roomId].aliveList, deadList: rooms[roomId].deadList});
            }
        }
    }

    function tally(vote){
        var executed = ""
        var tie = false;
        for(var i in vote){
            if(executed === "" || vote[i] > vote[executed]){
                executed = i;
                tie = false;
            }
            else if (vote[i] === vote[executed]){
                tie = true;
            }
        }
        if(tie || executed === ""){
            return "";
        }
        else{
            return executed;
        }
    }

    function changeToDay(roomId){
        rooms[roomId].vote = {};
        emitAliveDead(roomId);
    }

    function changeToNight(roomId){
        var users = rooms[roomId].users;

        for(var i=0; i < users.length; i++){
            if(io.sockets.connected[users[i].socketID]){
                io.sockets.connected[users[i].socketID].emit('set_nighttime', {});
            }
        }
        console.log('not implemented: change to night');
    }

    socket.on('day_vote', function(data){
        var vote = rooms[data.roomId].vote;

        if(rooms[data.roomId].numVoted){
            rooms[data.roomId].numVoted++;
        }
        else{
            rooms[data.roomId].numVoted = 1;
        }
        var users = rooms[data.roomId].users
        if(vote[data['votedfor']]){
            vote[data['votedfor']] += 1
        }
        else{
            vote[data['votedfor']] = 1
        }

        for(var i=0; i < users.length; i++){
            if(io.sockets.connected[users[i].socketID]){
                io.sockets.connected[users[i].socketID].emit('vote_cast', {user: data['user'], vote: data['votedfor'] });
            }
        }

        if(rooms[data.roomId].numVoted === rooms[data.roomId].numUsersAlive){
            var executed = tally(vote);
            if (executed === ""){
                for(var i=0; i < users.length; i++){
                    if(io.sockets.connected[users[i].socketID]){
                        io.sockets.connected[users[i].socketID].emit('nooneexecuted', {});
                    }
                }
                setTimeout(function(){ changeToNight(data.roomId); }, 5000);
            }
            else{ //kill the user who won the vote
                var index;
                for(var i=0; i < users.length; i++){
                    if(users[i].name === executed){
                        index = i;
                    }
                }

                //update Alive and Dead List
                var aliveList = rooms[data.roomId].aliveList
                var deadList = rooms[data.roomId].deadList
                aliveList[users[index].role] -= 1
                deadList[users[index].role] += 1

                for(var i=0; i < users.length; i++){
                    if(io.sockets.connected[users[i].socketID]){
                        io.sockets.connected[users[i].socketID].emit('executed', {user: executed, role: users[index].role});
                    }
                }

                if(io.sockets.connected[users[index].socketID]){
                    users[index].alive = false;
                    io.sockets.connected[users[index].socketID].emit('set_dead', {});
                }
                emitAliveDead(data.roomId);
                setTimeout(function(){ changeToNight(data.roomId); }, 5000);
            }
        }

    }); // end day vote

}
