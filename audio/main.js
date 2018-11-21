'use strict';

const startButton = document.querySelector('button#startB');
const speakButton = document.querySelector('button#ptp');
const audioBox = document.querySelector('div#audioBox');
const exRemoteAudio = document.querySelector('div#exRemoteAudio');
const statusLabel = document.querySelector('span#status');

const instantMeter = document.querySelector('#instant meter');
const slowMeter = document.querySelector('#slow meter');

const instantValueDisplay = document.querySelector('#instant .value');
const slowValueDisplay = document.querySelector('#slow .value');

var pcs = new Array();
var mySid;
var cnt = 0;


var nickname = encodeURI(prompt('昵 称', '匿名'));
var room = prompt('Room', 'PUBLIC_AUDIO');
			
var sw = $("[name='audio-checkbox']")
sw.hidden = false;
sw.bootstrapSwitch({
	state: false,
	onText : "开启",
	offText : "静音",
	onColor : "success",
	offColor : "default",
	onSwitchChange: ((s,e) => {
		window.s = s;
		localStream.getAudioTracks()[0].enabled = e;
	})
});

speakButton.ontouchstart
	= speakButton.onmousedown
	= window.onkeydown
	= (() => {
	sw.bootstrapSwitch('state', true);
});
speakButton.ontouchend
	= speakButton.onmouseup
	= window.onkeyup
	= (() => {
	sw.bootstrapSwitch('state', false);
});


document.querySelector('div#spcol').className="col-md-2 col-sm-4 col-xs-6";

try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  window.audioContext = new AudioContext();
} catch (e) {
  alert('Web Audio API not supported.');
}

const soundMeter = new SoundMeter(window.audioContext);

var socket;
var offerConfig = {
	offerToReceiveAudio: true,
	offerToReceiveVideo: false
};
const mediaStreamConstraints = {
	video: false,
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
		startButton.className='btn btn-primary' ;
		startButton.innerText='重连';
	});


	socket.on('new', (data) => {
		var sid = data.sid;
		console.log('new one <' + decodeURI(data.nickname) + '> coming ' + sid);

		var pc = find_or_create_pc(sid, data.nickname);
		doOffer(pc);
	});

	socket.on('candidate', (can) => {
		if(can.targetSid == mySid) {
			var pc = find_or_create_pc(can.selfSid, can.nickname);
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
			var pc = find_or_create_pc(des.selfSid, des.nickname);
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
			var pc = find_or_create_pc(des.selfSid, des.nickname);
			pc.setRemoteDescription(new RTCSessionDescription(des.description))
				.catch((e)=> {console.log('get answer, set remote error '+e);});
			statusLabel.innerText='状态: 已连接';
			statusLabel.className='label label-success';
		}
	});
}

startButton.onclick= startCon;

var localStream;

var stream = navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
	.then(gotLocalMediaStream)
	.catch(handleLocalMediaStreamError);

function gotLocalMediaStream(mediaStream) {
	localStream = mediaStream;
	localStream.getAudioTracks()[0].enabled = false;
	soundMeter.connectToSource(localStream);
	setInterval(() => {
      instantMeter.value = instantValueDisplay.innerText =
        soundMeter.instant.toFixed(2);
      slowMeter.value = slowValueDisplay.innerText =
        soundMeter.slow.toFixed(2);
	
	  pcs.forEach((pc) => {
		  pc.myMeter.value = pc.mySM.instant;
	  })
    }, 200);
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

function find_or_create_pc(sid, nickname) {
	var pc;
	pc = pcs.find((e) => {return e.remoteSid == sid});
	if(typeof pc == "undefined") {
		console.log('create new pc, to '+sid);
		cnt +=1;
		console.log(pcs);
		var rv = exRemoteAudio.cloneNode(true);
		rv.id = "remote" + cnt;
		rv.hidden = false;
		rv.querySelector("h4 i").innerText = decodeURI(nickname); 
		audioBox.appendChild(rv);
		pc = setupPc(rv);
		pc.remoteSid = sid;
		pcs.push(pc);
	}
	return pc;
}

function setupPc(rv) {
	var pc = new RTCPeerConnection(pcConfig);

	pc.mySM = new SoundMeter(window.audioContext);
	pc.myMeter = rv.querySelector("meter");
	pc.stateSpan = rv.querySelector("span");

	pc.onicecandidate = handleIceCandidate;
	pc.ontrack = ((event)=> {
		rv.querySelector("audio").srcObject = event.streams[0];
		pc.mySM.connectToSource(event.streams[0]);
	});
	pc.oniceconnectionstatechange = (() => {
		pc.stateSpan.innerText = pc.iceConnectionState;
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
					room: room,
					nickname: nickname
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
					room: room,
					nickname: nickname
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


