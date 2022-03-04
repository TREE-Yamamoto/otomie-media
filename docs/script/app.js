/**
□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■
◆UIManagere.js

const onReady = (tf) => {
    debugLog("onReady");
    if (tf == true) {
        debugLog("minOn success");
    }
    else {
        debugLog("micOn not sucessed");
    }
}

const micOnTouched = () => {
    micOn({onReady});
}
□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■□■
 */



// window.addEventListener("load", () => {
//     getCanvases();

//     document.querySelector("#TitleWindow").addEventListener("click", micOn);
//     document.querySelector("#drawRealTime").addEventListener("click", ()=>{drawRealTime(canvasFrequency,{})});
//     debugLog("canvasFrequency:   " + canvasFrequency);
//     document.querySelector("#getArchive").addEventListener("click", getArchive);
//     document.querySelector("#initRec").addEventListener("click", initRec);
//     document.querySelector("#recording").addEventListener("click", recording);
//     document.querySelector("#stopRec").addEventListener("click", stopRec);
//     document.querySelector("#play").addEventListener("click", ()=>{play(A_canvasFrequency,{})});
//     document.querySelector("#stopPlay").addEventListener("click", stopPlay);
//     document.querySelector("#deleteData").addEventListener("click", deleteData);

//     //document.querySelector("#ButtonOpenMovie").addEventListener("click", playDataList);

//     debugLog("load finish");
// });

//◆ app.js
const micOn = ({
    onReady = () => { },
    onComplete = () => { }
} = {}) => {
    debugLog("micON called");

    //マイクをONにする処理  
    startCollecting({ onReady, onComplete });
}

// drawRealTime(_canvas, { onReady, onProcess, onComplete });
// play(_canvas, { onReady, onProcess, onComplete });

const drawRealTime = (_canvas, _canvasTL, _canvasPB, {
    onReady = () => { },
    onProcess = () => { },
    onComplete = () => { },
} = {}) => {

    //リアルタイム描画する処理


    switchRealTime(_canvas, _canvasTL, { onReady, onProcess, onComplete });
    initCanvasPB(_canvasPB);

}

const getArchive = (_canvas, {
    onReady = () => { },
    getNum = () => { },
    getImage = () => { },
    onComplete = () => { },
} = {}) => {

    //収録データを取得する処理
    debugLog("_canvas", _canvas);
    debugLog("サムネイル用キャンバスに描画");
    debugLog("getArchive");

    if (playingData !== null) {
        onReady(true);

        getNum(getNumPlayingData());
        if (thumbnail !== null) {
            getImage(thumbnail);
        }
        onComplete(true);

    }

}

const initRec = ({
    onReady = () => { },
    onComplete = () => { },
} = {}) => {

    //収録データを取得する処理
    // ・
    // ・
    // ・
    debugLog("initRec");
    // setCallBack(initRecCB,{onReady,onComplete});
    prepareRec({ onReady, onComplete });

}


const recording = ({
    onReady = () => { },
    onProcess = () => { },
    onComplete = () => { },
} = {}) => {
    //収録データを取得する処理
    startRecording({ onReady, onProcess, onComplete });

}

const stopRec = (_canvas, {
    onReady = () => { },
    onComplete = () => { },
    getRecTime = () => { },
}) => {
    stopRecording(_canvas, { onReady, onComplete });
    getRecTime(Date.now());
    debugLog("stopRec");
}

const play = (_canvas, {
    onReady = () => { },
    onProcess = () => { },
    onComplete = () => { },
}) => {

    playDataList(_canvas, { onReady, onProcess, onComplete });
}


const stopPlaying = ({
    onReady = () => { },
    onComplete = () => { },
}) => {
    //再生停止する処理
    stopDataList({ onReady, onComplete });
    debugLog("stopPlay");

}

const restartPlaying = ({
    onReady = () => { },
    onComplete = () => { },
}) => {
    //再生停止する処理
    restartDataList({ onReady, onComplete });
    debugLog("stopPlay");

}



const deleteData = ({
    onReady = () => { },
    onComplete = () => { },
}) => {
    debugLog("deleteData");
    deletePlayingData({ onReady, onComplete });

}

