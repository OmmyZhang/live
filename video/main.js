'use strict';

const startButton = document.querySelector('button#startB');
const videoBox = document.querySelector('div#videoBox');
const localVideo = document.querySelector('video#localV');
const exRemoteVideo = document.querySelector('video#example');
const statusLabel = document.querySelector('span#status');


localVideo.onclick = fs;

function fs(event) {
	var v = event.target;
	v.fulls = v.requestFullscreen ||
		v.mozRequestFullScreen || 
		v.webkitRequestFullscreen ||
		v.msRequestFullscreen;
	v.fulls();
}

var pcs = new Array();
var mySid;
var cnt = 0;

var nickname = prompt('昵 称', '匿名');
var room = prompt('Room', 'PUBLIC');

var socket;
var offerConfig = {
	offerToReceiveAudio: true,
	offerToReceiveVideo: true
};
const mediaStreamConstraints = {
	video: true,
	audio: true
};
function setupSocket() {
	socket = io.connect(api_url);

	socket.on('joined', (sid) => {
		console.log(sid);
		mySid = sid;
		//doOffer();
		console.log('连接成功');
		statusLabel.innerText='状态: 等待响应';
		statusLabel.className='label label-warning';
		//startButton.disabled = true;
		startButton.innerText = '重连';
	});


	socket.on('new', (data) => {
		var sid = data.sid;
		console.log('new one <' + data.nickname + '> coming ' + sid);

		var pc = find_or_create_pc(sid);
		doOffer(pc);
	});

	socket.on('candidate', (can) => {
		if(can.targetSid == mySid) {
			var pc = find_or_create_pc(can.selfSid);
			pc.addIceCandidate(new RTCIceCandidate({
				sdpMLineIndex : can.label,
				candidate : can.candidate
			})).catch((e)=>{console.log('add can error '+e);});
		}
	});
	socket.on('offer', (des) => {
		console.log('rcv offer');
		console.log('targetSid: ' + des.targetSid)
		if(des.targetSid == mySid) {
			console.log('my offer');
			console.log(des.selfSid);
			var pc = find_or_create_pc(des.selfSid);
			pc.setRemoteDescription(new RTCSessionDescription(des.description))
				.catch((e)=> {console.log('get offer, set remote  error '+e);});

			doAnswer(pc);
			statusLabel.innerText='状态: 已连接';
			statusLabel.className='label label-success';
		}
	});
	socket.on('answer', (des) => {
		console.log('rcv answer');
		if(des.targetSid == mySid) {
			var pc = find_or_create_pc(des.selfSid);
			pc.setRemoteDescription(new RTCSessionDescription(des.description))
				.catch((e)=> {console.log('get answer, set remote error '+e);});
			statusLabel.innerText='状态: 已连接';
			statusLabel.className='label label-success';
		}
	});
}

startButton.onclick= startCon;

var localStream;
var remoteStream;

var stream = navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
	.then(gotLocalMediaStream)
	.catch(handleLocalMediaStreamError);

function gotLocalMediaStream(mediaStream) {
	localVideo.srcObject = mediaStream;
	localStream = mediaStream;
}

function handleLocalMediaStreamError(error) {
	console.log('navigator.getUserMedia error: ', error);
	alert('Error: ' + error);
}

function startCon() {
	setupSocket();
	console.log('setup socket finished');
	socket.emit('join', {
		'nickname': nickname ,
		'room': room
	});
}

function find_or_create_pc(sid) {
	var pc;
	pc = pcs.find((e) => {return e.remoteSid == sid});
	if(typeof pc == "undefined") {
		console.log('create new pc, to '+sid);
		cnt +=1;
		console.log(pcs);
		var rv = exRemoteVideo.cloneNode();
		rv.onclick = fs;
		rv.id = "remote" + cnt;
		rv.hidden = false;
		videoBox.appendChild(rv);
		pc = setupPc(rv);
		pc.remoteSid = sid;
		pcs.push(pc);
	}
	return pc;
}

function setupPc(rv) {
	var pc = new RTCPeerConnection(pcConfig);

	pc.onicecandidate = handleIceCandidate;
	pc.ontrack = ((event)=> {
		rv.srcObject = event.streams[0];
	});
	pc.oniceconnectionstatechange = (() => {
		if(pc.iceConnectionState == 'disconnected' || pc.iceConnectionState == 'failed') {
			console.log('someone leave or failed');
			rv.hidden = true;
		}
		else{
			rv.hidden = false;
		}
	});
	try {
		pc.addStream(localStream);
	}catch(e) {
		console.log(e);
	}

	return pc;
}

function doOffer(pc)
{
	pc.createOffer(offerConfig)
		.then((description) => {
			pc.setLocalDescription(description).then(() => {
				socket.emit('offer', {
					description: description,
					targetSid: pc.remoteSid,
					selfSid: mySid,
					room: room
				});
			});
		});
}



function doAnswer(pc) {
	pc.createAnswer()
		.then((description) => {
			pc.setLocalDescription(description).then(() => {
				socket.emit('answer', {
					description: description,
					targetSid: pc.remoteSid,
					selfSid: mySid,
					room: room
				});
			});
		}).catch((e) => {console.log('error: ' + e)});
}

function handleIceCandidate(event) {
	console.log('ice!');

	const iceCandidate = event.candidate;

	if (iceCandidate) {
		socket.emit('candidate', {
			id : iceCandidate.sdpMid,
			label : iceCandidate.sdpMLineIndex,
			candidate : iceCandidate.candidate,
			targetSid: event.target.remoteSid,
			selfSid: mySid,
			room: room,
			nickname: nickname
		});
	} else {
		console.log('End of icecan.');
	}
}


