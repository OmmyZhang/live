from flask import Flask, request
from flask_socketio import SocketIO, send, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!@#$%'
socketio = SocketIO(app)

if __name__ == '__main__':
    socketio.run(app)

@socketio.on('join')
def handle_join(data):
    print(request.sid)
    nickname = data['nickname']
    room = data['room']
    join_room(room)

    emit('joined', request.sid)
    emit('new', {
        'sid': request.sid,
        'nickname': nickname,
        }, room = room, include_self=False)


@socketio.on('candidate')
def get_candidate(can):
    print(can)
    emit('candidate', can, room=can['room'], include_self=False)

@socketio.on('offer')
def get_offer(des):
    print('offer:')
    #print(des)
    print(des['selfSid'], ' --> ', des['targetSid'])
    emit('offer', des, room=des['targetSid'], include_self=False)

@socketio.on('answer')
def get_ans(des):
    print('answer:')
    #print(des)
    print(des['selfSid'], ' --> ', des['targetSid'])
    emit('answer', des, room=des['targetSid'], include_self=False)


@socketio.on('connect')
def newcnt():
    print('connect ' + request.sid)

@socketio.on('disconnect')
def discnt():
    print('disconnect ' + request.sid)

