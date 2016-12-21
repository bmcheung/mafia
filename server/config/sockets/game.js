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

        rooms[roomId].mafiavote = {}
    }

    function mafiaDoneVoting(roomId){
        var voted;
        for(var key in rooms[roomId].mafiavote){
            if(voted === undefined){
                voted = rooms[roomId].mafiavote[key];
            }
            else{
                if(voted !== rooms[roomId].mafiavote[key]){
                    return false;
                }
            }
        }
        return true;
    }

    function gameEnd(roomId){
        var room = rooms[roomId]
        var users = rooms[roomId].users
        if(room.aliveList.Mafia > (Math.ceiling(room.numUsersAlive/2))){
            console.log('Mafia Won')
            var endMSG = 'GAME OVER --- MAFIA has Won!'
            for(var i = 0; i < users.length; i++){
                if(io.sockets.connected[users[i].socketID]){
                    io.sockets.connected[users[i].socketID].emit('game_over', {end: endMSG});
                }
            }
        }
        else if(room.aliveList.Mafia == 0){
            console.log('Village Won')
            var endMSG = 'GAME OVER --- CITIZENS have Won!'
            for(var i = 0; i < users.length; i++){
                if(io.sockets.connected[users[i].socketID]){
                    io.sockets.connected[users[i].socketID].emit('game_over', {end: endMSG});
                }
            }
        }
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

                gameEnd(data.roomId)

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

    socket.on('night_vote', function(data){
        var room = rooms[data.roomId];
        if(data.role == 'Mafia'){
            var users = room.users;
            for(var i = 0; i < users.length; i++){
                if(io.sockets.connected[users[i].socketID] && users[i].role === 'Mafia'){
                    io.sockets.connected[users[i].socketID].emit('mafia_votecast', {user: data.user, vote: data.votedfor });
                }
            }
            room.mafiavote[data.user] = data.votedfor;
            if(mafiaDoneVoting(roomId)){
                room.mafiaexecute = data.votedfor;
                //disable mafia voting
                for(var i = 0; i < users.length; i++){
                    if(io.sockets.connected[users[i].socketID] && users[i].role === 'Mafia'){
                        io.sockets.connected[users[i].socketID].emit('mafia_votedone', {});
                    }
                }
            }
        }
    }) // end night vote

}
