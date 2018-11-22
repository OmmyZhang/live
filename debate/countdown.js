var ct = 0;

function set_ct() {
	var sH = ct % 60;
	var mH = (ct - sH) / 60;

	var sL = ct % 10;
	sH = (sH-sL) / 10;
	var mL = mH % 10;
	mH = (mH - mL) / 10;

	document.querySelector('span#s1').innerText = sH;
	document.querySelector('span#s2').innerText = sL;
	document.querySelector('span#m1').innerText = mH;
	document.querySelector('span#m2').innerText = mL;
}

setInterval(() => {
	if(ct > 0 && sw.bootstrapSwitch("state")) {
		--ct;
		set_ct();
		if(ct == 0) {
			setTimeout(()=>{alert('时间到')}, 100); // render innerText need time
		}
	}
}, 1000);

document.querySelector('button#timeInputBtn').onclick = (() => {
	var t = document.querySelector('input#timeInput');
	if(t.value != "" && t.checkValidity()) {
		ct = t.value;
		set_ct();
		console&&console.log('input time');
	}
	else {
		alert('无效的时间');
	}
});
