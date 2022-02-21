
// クロスブラウザ定義
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;


//変数定義
const beforeStorageTime = 1.0;                  //収録開始前保存する時間
const afterStorageTime = 5.0;                   //収録開始後保存する時間上限

const pitchMax = 4000.0;
const pitchMin = 27.0;
//時間系
let startTime;
let audioTime;


//音源保存用変数
let localMediaStream = null;
let localScriptProcessor = null;
let audioCtx;                               //オーディオコンテキスト格納変数
let bufferSize = 1024;                          //音源データ用バッファサイズ
let bufferData = new Float32Array(bufferSize);  //音源データ用バッファ

let audioData = [];                             //バッファデータをPushしていくオブジェクト
let spectrums;                                  //周波数ごとのデータを保存する配列
let spectrumPeak;                               //周波数のピークの値
let N_spectrumPeak;                             //周波数のピークの値(正規化)
let volumePeak;                                     //周波数のピークの値
let N_volumePeak;                                   //周波数のピークの値(正規化)
let timeDomainArray;                            //時間領域ごとのデータを保存する配列
let audioDeltaTime;                             //オーディオ処理ごとのデルタタイム用変数

//状態管理
let isCollecting = false;                       //収音中
let isRecording = false;                        //収録中
let isPlaying = false;                          //再生中

//描画スイッチ
let isDrawRealTime = false;

let realTimeCanvas;

let audioAnalyser;

let dataIndex = 0;              //再生中dataListを順に見るためのIndex

let playingData = {};
let fsDivN;                     //周波数分解能(何ヘルツおきに点を配置するか) 

let startCollectingTime = 0;
let recTime = 0;

let animationBeforeTime = -1;
let animationCurrentTime = 0;
let drawDeltaTime = 0;
let audioLastTime = -1;

let data = {};
let frameData = {};
let dataList = [];
let raw = {
    PCM: [],            //(floatの配列)
    frequency: [],      //(Uintの配列)
    timeDomain: [],     //(Uintの配列)
    volume: 0.0,        //(float)
    pitch: 0.0,         //(float)
    sharpness: 0.0,     //(float)
    roughness: 0.0,     //(float)
};
let visual = {               //ビジュアル用に正規化
    volume: 0.0,        //(float)     【0－1】
    pitch: 0.0,         //(float)     【0－1】
    sharpness: 0.0,     //(float)     【0－1】
    roughness: 0.0,     //(float)     【0－1】     
};


//app.jsからのコールバック一時保存用
let micOnCB = {};
let drawReatTimeCB = {};
let initRecCB = {};
let onRecCB = {};

const prepareRec = (_initRecCB) => {
    playingData = {};
    initRecCB = _initRecCB;
    _initRecCB.onReady(true);
    _initRecCB.onComplete(true);
};

const startRecording = (_onRecCB) => {
    //debugLog("startRecorging");
    if (!isRecording) {
        isRecording = true;
        recTime = 0;
        isPlaying = false;

        //現在時刻，sampleRate，fsdivN，をDataに入れる．
        data.time = new Date();
        data.samplingRate = audioCtx.sampleRate;
        data.fsDivN = fsDivN;
        debugLog("data:     " + data.time);
        _onRecCB.onReady(true);
        onRecCB = _onRecCB
        //onRecCB.onComplete(true);
    }
};

const stopRecording = (_stopRecCB) => {
    if (isRecording) {
        isRecording = false;
        startCollectingTime = 0;                             //時間をリセット
        data.dataList = dataList;
        archiveData(data);
        debugLog("stopRecording");
        recTime = 0;
        _stopRecCB.onReady(true);
        _stopRecCB.onComplete(true);


        //

        // getPCMData(playingData);
    }
}


let playAudioCtx;           //再生用オーディオコンテキスト
let playAudioBuffer;

let playsource;

//再生用のオーディオコンテキストを作る．
const initPlayAudioCtx = () => {
    playAudioCtx = new AudioContext();
    // let source = playAudioCtx.createMediaStreamSource(stream);
    source = playAudioCtx.createBufferSource();
    playAudioBuffer = playAudioCtx.createBuffer()
    //source.buffer = ...;
    //let processor = playAudioCtx.createScriptProcessor(1024,1,1);
    //source.connect(processor);



}

//音を再生する．
const playSound = () => {
    source.connect(playAudioCtx.destination);
}


//dataをJsonにする
const archiveData = (_data) => {
    let jsonData = JSON.stringify(_data);
    //exportText("jsonData.json",jsonData);
    createJsonDataFormat();
    decordeJsonDataList(jsonData);
    jsonData = {};
}

//受けとったJsonデータをオブジェクトにへんかんする．
const decordeJsonDataList = (jsonData) => {
    console.log("jsonData" + jsonData);
    playingData = JSON.parse(jsonData);
}

const otomieVisual_Rec = new OtomieVisual();
//再生ボタンを押下したときに実行される関数．
const playDataList = (_canvas, callback) => {
    if (!isRecording) {
        if (playingData) {
            if (!isPlaying) {
                isPlaying = true;
                dataIndex = -1;

                if (_canvas.hasChildNodes() == false) {
                    console.log("_canvas", _canvas);
                    otomieVisual_Rec.setup(_canvas, 1024, 1024);
                }
                // const otomieVisual = new otomieVisual.OtomieVisual();
                // isDrawRealTime = false;

                //◇収録データの再生を開始
                if (audioCtx.state === "running") {
                    playPCMData();
                }
                callback.onReady(true);
                otomieVisual_Rec.play();

                //収録したデータの中からPCMのみ抽出
                //bufferSourceノード生成
                //オーディオバッファノード生成
                //オーディオバッファノードに抽出したPCMをセット
                //パラメータ設定
                //ソーススタート
                animateCanvases(_canvas, callback);
            }
        }
    } else {
        return;
    }
}
let playDataSource;
const playPCMData = () => {
    playDataSource = audioCtx.createBufferSource();
    let PCMdata = getPCMData(playingData);
    let audioBuffer = audioCtx.createBuffer(1, PCMdata.length, audioCtx.sampleRate);
    audioBuffer.getChannelData(0).set(PCMdata);
    playDataSource.buffer = audioBuffer;
    playDataSource.loop = false;                   //. ループ再生するか？
    playDataSource.loopStart = 0;                  //. オーディオ開始位置（秒単位）
    playDataSource.loopEnd = audioBuffer.duration; //. オーディオ終了位置（秒単位）
    playDataSource.playbackRate.value = 1.0;       //. 再生速度＆ピッチ

    playDataSource.connect(audioCtx.destination);

    //. for lagacy browsers

    playDataSource.start(0);
    // if (isPlaying == false) {
    //     source.stop();
    //     console.log("source.Stop()");
    // }

}


//収録データからPCMをgetする．
const getPCMData = (_playingData) => {
    let PCMData = [];
    let result = [];
    for (let i = 0; i < _playingData["dataList"].length - 1; i++) {
        PCMData.push(_playingData["dataList"][i]["raw"]["PCM"]);
    }
    //console.log("PCMData", PCMData);
    PCMData.forEach(element => {
        result = result.concat(Object.values(element));
    });
    //console.log(result);
    return result;

}



//再生ボタンを押下したときに実行される関数．
const stopDataList = (_stopPlayingCB) => {
    if (!isRecording) {
        if (isPlaying) {
            isPlaying = false;
            dataIndex = -1;
            console.log("isPlaying", isPlaying);
            //◇収録データの再生を停止
            _stopPlayingCB.onReady(true);
            _stopPlayingCB.onComplete(true);
        }
    } else {
        return;
    }
}

// 録音バッファ作成（録音中自動で繰り返し呼び出される）
const onAudioProcess = (e) => {
    if (audioLastTime < 0) {
        audioLastTime = audioCtx.currentTime;
        return;
    }
    if (!isCollecting) {
        return;
    }
    // 音声のバッファを作成，インプットデータを保存
    let input = e.inputBuffer.getChannelData(0);    //PCMデータ：信号の強度が格納されている.
    bufferData = new Float32Array(input);

    analyseVoice();
};


const setCallBack = (_obj = {}, _CBObj = {}) => {
    _obj.onReady = _CBObj.onReady;
    _obj.onProcess = _CBObj.onProcess;
    _obj.onComplete = _CBObj.onComplete;

}

const startCollecting = (_micOnCB = {}) => {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    debugLog("startCollecting");
    // サンプルレートを保持しておく
    isCollecting = true;
    const promise = navigator.mediaDevices.getUserMedia(
        {
            audio: {
                sampleRate: { ideal: 48000 },
            },
            video: false
        }
    );

    promise.then(sucsess)
    //.then(error);

    function sucsess(stream) {       //メディアアクセス要求が承認されたときに呼ばれる関数
        // 音声入力関連のノードの設定

        localMediaStream = stream;
        let scriptProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        localScriptProcessor = scriptProcessor;
        let mediastreamsource = audioCtx.createMediaStreamSource(stream);
        mediastreamsource.connect(scriptProcessor);
        scriptProcessor.onaudioprocess = onAudioProcess;
        scriptProcessor.connect(audioCtx.destination);

        // 音声解析関連のノードの設定
        audioAnalyser = audioCtx.createAnalyser();
        audioAnalyser.fftSize = 2048;
        //frequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
        //timeDomainData = new Uint8Array(audioAnalyser.fftSize);
        mediastreamsource.connect(audioAnalyser);
    };
    // function error(e) {
    //     alert(e);
    //     debugLog(e);
    // };

    createJsonDataFormat();
    _micOnCB.onReady(true);
};


const createJsonDataFormat = () => {
    data = {
        time: "20220124195600",         //(String)
        samplingRate: 48000,            //(int)
        fsDivN: 0,                      //(float)
        dataList: [                     //(オブジェクトの配列)
            {
                deltaTime: 0,           //(float)
                raw: {
                    PCM: [],            //(floatの配列)
                    frequency: [],      //(Uintの配列)
                    timeDomain: [],     //(Uintの配列)
                    volume: 0.0,        //(float)
                    pitch: 0.0,         //(float)
                    sharpness: 0.0,     //(float)
                    roughness: 0.0,     //(float)
                },
                visual: {               //ビジュアル用に正規化
                    hue: 0.0,
                    saturation: 0.0,
                    brightness: 0.0,
                    objectCount: 0.0,
                    objectShape: 0.0,
                    speed: 0.0,
                }
            }
        ],//rawDataList
    }
}



//音の生データ，FFTデータを1回の解析ごとに保存していく処理．
//音の生データ，FFTデータを1回の解析ごとに保存していく処理．
const createFrameDataObj = () => {
    //ビジュアル要データオブジェクトにデータを格納
    let frameData = {};
    frameData.deltaTime = audioDeltaTime;

    raw = {};
    visual = {};

    raw.PCM = Object.values(bufferData);
    raw.timeDomain = Object.values(timeDomainArray);
    raw.frequency = Object.values(spectrums);
    raw.pitch = spectrumPeak;
    raw.volume = volumePeak;

    let pitch = 0;
    let volume = 0;
    let roughness = 0;
    let sharpness = 0;

    visual.pitch = 0;
    visual.volume = 0;
    visual.roughness = 0;
    visual.sharpness = 0;

    visual.hue = 0;
    visual.saturation = 0;
    visual.brightness = 0;
    visual.objectCount = 0;
    visual.objectShape = 0;
    visual.speed = 0;

    // visual.pitch = N_spectrumPeak;

    pitch = Math.min(pitchMax, Math.max(spectrumPeak, pitchMin));   //クリッピング
    pitch = (pitch - pitchMin) / (pitchMax - pitchMin);             //正規化

    volume = N_volumePeak;

    sharpness = Math.abs(Math.sin((performance.now() / 1000) * 0.1));

    roughness = Math.abs(Math.sin((performance.now() / 1000) * 0.1));

    visual.hue = calcHue(sharpness);
    visual.saturation = volume;
    visual.brightness = pitch;
    visual.objectCount = calcObjectCount(pitch, volume);
    visual.objectShape = sharpness;
    visual.speed = pitch;

    frameData.raw = raw;
    frameData.visual = visual;

    debugLog("frameData", frameData);
    return frameData;

}

const calcHue = (_sharpness) => {
    // const { sharpness, volume, pitch } = this.soundData;
    let hue = 360 * (Math.abs(_sharpness - 0.5) * 2) / 360;
    // let rgb = this.hsvToRgb(hue, volume, pitch);
    // this.drawInfo.colorMain = PIXI.utils.rgb2hex(rgb);
    // rgb = this.hsvToRgb(hue, volume, pitch * 0.7);
    // this.drawInfo.colorSub = PIXI.utils.rgb2hex(rgb);
    return hue;
}

const calcObjectCount = (_pitch, _volume) => {
    // const { pitch, volume } = this.soundData;
    let rate = (_pitch + -1 * _volume + 1) * 0.5;
    return rate;
}

//解析データをリストに積んでいく処理
const createData = (_frameData) => {
    dataList.push(_frameData);
    startCollectingTime += _frameData.deltaTime;

    //1秒分のデータが保存されたらリストからシフトしていく処理
    if (startCollectingTime >= beforeStorageTime) {
        if (!isRecording) {
            dataList.shift();
        }
    }
    data.dataList = dataList;
}



//解析用処理
const analyseVoice = () => {
    fsDivN = audioCtx.sampleRate / audioAnalyser.fftSize;           //周波数分解能

    //デルタタイムの算出
    calcAudioDeltaTime();

    let tracks = localMediaStream.getTracks();
    for (let i = 0; i < tracks.length; i++) {

        let constraints = tracks[i].getConstraints()

        // 音声トラックの制約
        if (tracks[i].kind == 'audio') {
        }
    }

    spectrums = new Uint8Array(audioAnalyser.frequencyBinCount);        //周波数領域の振幅データ格納用配列を生成
    audioAnalyser.getByteFrequencyData(spectrums);                      //周波数領域の振幅データを配列に格納：一瞬の値

    //timeDomainArray = new Float32Array(audioAnalyser.fftSize);        //時間領域の振幅データ格納用配列を生成
    timeDomainArray = new Uint8Array(audioAnalyser.fftSize);            //時間領域の振幅データ格納用配列を生成
    audioAnalyser.getByteTimeDomainData(timeDomainArray);               //時間領域の振幅データを配列に格納    


    let dataIndex = data["dataList"].length - 1;
    calcFrequencyPeak(data, dataIndex);
    calcVolumePeak(data, dataIndex);

    let frameDataObj = createFrameDataObj();                            //1フレーム分のデータ生成
    createData(frameDataObj);

    countRecTime(audioDeltaTime, onRecCB);
    judgeRecTime(afterStorageTime);
    drawRTGraphic(realTimeCanvas, data, dataIndex, drawReatTimeCB);
    drawRectangle(data, dataIndex, CanvasWaveFormRec);
    getVisualData(data, dataIndex);

}
//オーディオ用のデルタ時間を計算
const calcAudioDeltaTime = () => {
    audioDeltaTime = audioCtx.currentTime - audioLastTime;
    audioLastTime = audioCtx.currentTime;
}


const getVisualData = (_data, _index) => {
    let visualData = _data["dataList"][_index]["visual"];
    debugLog("visualData" + JSON.stringify(visualData));
    debugLog("visualData", visualData);
    return visualData;
}

//リアルタイム描画開始用のスイッチ

const switchRealTime = (_canvas, _drawReatTimeCB) => {
    // realTimeCB.onReady = onReady;
    // realTimeCB.onProcess = onProcess;
    // realTimeCB.onComplete = onComplete;

    if (isDrawRealTime == false) {
        isDrawRealTime = true;
        debugLog("isDrawRealTime" + isDrawRealTime);
        setCanvas(_canvas);

        //◇リアルタイム描画開始処理
    }
    else if (isDrawRealTime == true) {
        isDrawRealTime = false;
        debugLog("isDrawRealTime" + isDrawRealTime);
    }
}

const setCanvas = (_canvas) => {
    realTimeCanvas = _canvas;
}

const drawRTGraphic = (_canvas, _data, _dataIndex, _drawReatTimeCB) => {
    if (_canvas != null) {
        if (isDrawRealTime == true) {
            // console.log("dataIndex",_);
            otomieVisual.updateSoundData(_data["dataList"][_dataIndex]["visual"]);

            drawSpectCanvas(_data, _dataIndex, _canvas);
            _drawReatTimeCB.onProcess(isDrawRealTime);
        }
        else {
            _drawReatTimeCB.onProcess(isDrawRealTime);
        }
    } else {
        debugLog("not _drawReatTimeCB");
        return;
    }
}



//収録時間を計算
const countRecTime = (_deltaTime, _onRecCB) => {
    if (isRecording == true) {
        recTime += _deltaTime;
        _onRecCB.onProcess(recTime);
        debugLog("recTime" + recTime);
    }
    else {
        return;
    }
}

//収録時間が上限に達したら収録を停止
const judgeRecTime = (_afterAtorageTime) => {
    if (recTime >= _afterAtorageTime) {
        debugLog("recTime >= afterAtorageTime");
        stopRecording();
        recTime = 0;
    }
    else {
        return;
    }
}

const deletePlayingData = (_deleteDataCB) => {
    if (playingData != null) {
        if (isPlaying == true) {
            isPlaying = false;
        }
        playingData = {};
        _deleteDataCB.onReady(true);
        _deleteDataCB.onComplete(true);

    }
}


const getNumPlayingData = () => {
    let numPlayingData = -1;
    if (Object.keys(playingData).length > 0) {
        numPlayingData = 1;

        // thumbnail = "thumbnail.png";
    } else {
        numPlayingData = 0;
        // thumbnail = "none";
    }
    debugLog("numPlayingData" + numPlayingData);
    return numPlayingData;
};
const getThumbnail = () => {
    let thumbnail = "";
    if (Object.keys(playingData).length > 0) {
        //numPlayingData = 1;
        thumbnail = "thumbnail.png";
    } else {
        // numPlayingData = 0;
        thumbnail = "none";
    }
    debugLog("thumbnail :" + thumbnail);
    return thumbnail;
};




//アニメーション再生・ループ
const animateCanvases = (_canvas, _callback) => {
    let data = playingData;
    if (isPlaying) {
        console.log("isPlaying", isPlaying);

        if (dataIndex == -1) {
            dataIndex = 0;
            startTime = performance.now() / 1000;
            audioTime = data["dataList"][dataIndex].deltaTime;
        }

        let drawTime = (performance.now() / 1000) - startTime;

        //描画対象のデータのインデックスを次に進める条件
        if (audioTime <= drawTime) {
            let Time = audioTime;
            let processIndex = dataIndex;

            for (let i = dataIndex; i < data["dataList"].length - 1; i++) {
                Time += data["dataList"][i].deltaTime;

                //描画対象のデータのインデックスを決定する条件
                if (drawTime <= Time) {
                    processIndex = i;
                    break;
                }
            }
            dataIndex = processIndex;
            _callback.onProcess(true);
            drawSpectCanvas(data, dataIndex, _canvas);
            otomieVisual_Rec.updateSoundData(data["dataList"][dataIndex]["visual"]);

            dataIndex += 1;
            //ループする条件
            if (data["dataList"].length - 1 < dataIndex) {
                dataIndex = -1;
                debugLog("loop");
                requestAnimationFrame(() => { animateCanvases(_canvas, _callback) });
                //音声再生もループする．
                playPCMData();

                return;
            }
            audioTime = Time;
        }
    }
    else {
        playDataSource.stop();
        otomieVisual_Rec.stop();
        console.log("isPlaying", isPlaying);
        return;
    }
    requestAnimationFrame(() => { animateCanvases(_canvas, _callback) });
}



//スペクトラムを描画
const drawSpectCanvas = (_data, _index, _canvas) => {
    let targetCanvas = _canvas;
    let targetCanvasContext = _canvas.getContext('2d');
    targetCanvasContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCanvasContext.beginPath();


    let rawData = _data["dataList"][_index]["raw"];         //描画処理する対象
    let visualData = _data["dataList"][_index]["visual"];
    let targetSpectDataList = rawData["frequency"];         //描画処理する対象の中の周波数データリスト



    for (let i = 0, len = targetSpectDataList.length; i < len; i++) {
        //canvasにおさまるように線を描画
        let x = (i / len) * targetCanvas.width;
        let y = (1 - (targetSpectDataList[i] / 255)) * targetCanvas.height;
        if (i === 0) {
            targetCanvasContext.moveTo(x, y);
        } else {
            targetCanvasContext.lineTo(x, y);
        }
        let f = Math.floor(i * fsDivN);                                     // index -> frequency;

        // if ((f % 500) === 0) {                                              // 500 Hz単位にy軸の線とラベル出力
        //     let text = (f < 1000) ? (f + ' Hz') : ((f / 1000) + ' kHz');
        //     targetCanvasContext.fillRect(x, 0, 1, targetCanvas.height);     // Draw grid (X)
        //     targetCanvasContext.fillText(text, x, targetCanvas.height);     // Draw text (X)
        // }
    }
    targetCanvasContext.stroke();

    // x軸の線とラベル出力
    // let textYs = ['1.00', '0.50', '0.00'];
    // for (var i = 0, len = textYs.length; i < len; i++) {
    //     let text = textYs[i];
    //     let gy = (1 - parseFloat(text)) * targetCanvas.height;
    //     // Draw grid (Y)
    //     targetCanvasContext.fillRect(0, gy, targetCanvas.width, 1);
    //     // Draw text (Y)
    //     targetCanvasContext.fillText(text, 0, gy);
    // }
}

//波形データを描画
const drawTimeDomainCanvas = (_data, _index, _canvas) => {
    let targetCanvas = _canvas;
    let targetCanvasContext = _canvas.getContext('2d');
    targetCanvasContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCanvasContext.beginPath();

    //描画処理する対象のvisData
    let rawData = _data["dataList"][_index]["raw"];

    //visDataの中の時間領域データリスト
    let targetTimeDomainDataList = rawData["timeDomain"];
    debugLog(targetTimeDomainDataList);

    for (var i = 0, len = targetTimeDomainDataList.length; i < len; i++) {
        //canvasにおさまるように線を描画
        let x = (i / len) * targetCanvas.width;
        let y = (1 - (targetTimeDomainDataList[i] / 255)) * targetCanvas.height;
        if (i === 0) {
            targetCanvasContext.moveTo(x, y);
            debugLog("x:    " + x);
            debugLog("y:    " + y);
        } else {
            targetCanvasContext.lineTo(x, y);
        }
        var f = Math.floor(i * fsDivN);  // index -> frequency;
    }
    targetCanvasContext.stroke();
}

//スペクトログラムを描画
const drawSpectrogram = (_data, _index, _canvas) => {
    let targetCanvas = _canvas;
    let targetCanvasContext = _canvas.getContext('2d');
    //targetCanvasContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    targetCanvasContext.beginPath();

    targetCanvasContext.drawImage(_canvas, -1, 0);

    //描画処理する対象のvisData
    let rawData = _data["dataList"][_index]["raw"];
    //visDataの中の周波数データリスト
    let targetSpectDataList = rawData["frequency"];

    let maxSpectrumIndex = targetSpectDataList.indexOf(Math.max(...targetSpectDataList));
    debugLog("maxSpectrumIndex:          " + maxSpectrumIndex);
    debugLog("maxSpectrumIndex.spectrum:          " + targetSpectDataList[maxSpectrumIndex]);


    for (let i = 0; i < targetCanvas.height; i++) {
        // 描画色指定
        if (i < targetSpectDataList.length) {
            targetCanvasContext.fillStyle = colorMap[targetSpectDataList[i]];
        } else {
            targetCanvasContext.fillStyle = colorMap[0];
        }
        if (i == maxSpectrumIndex) {
            targetCanvasContext.fillStyle = "rgb(255,0,0)";
            targetCanvasContext.fillRect(targetCanvas.width - 1, targetCanvas.height - 1 - i, 2, 2);
        } else {
            targetCanvasContext.fillRect(targetCanvas.width - 1, targetCanvas.height - 1 - i, 1, 1);
        }
    }
}

//周波数ピークを計算
const calcFrequencyPeak = (_data, _index) => {
    let rawData = _data["dataList"][_index]["raw"];
    let requencyList = rawData["frequency"];
    let spectrumPeakIndex = requencyList.indexOf(Math.max(...requencyList));
    spectrumPeak = fsDivN * spectrumPeakIndex;
    N_spectrumPeak = spectrumPeak / (audioCtx.sampleRate / 2);

}


//振幅のピークを計算
const calcVolumePeak = (_data, _index) => {
    let peak = -100;
    for (let i = 0, len = _data["dataList"][_index]["raw"]["timeDomain"].length; i < len; i++) {
        const sample = _data["dataList"][_index]["raw"]["timeDomain"][i];
        if (sample > peak) {
            peak = sample;
            volumePeak = peak;
            N_volumePeak = peak / 255;
            //volObj = { volume, N_volume };
        }
    }
}


const getVolumePeak = (_data, _index) => {
    let peak = -100;
    let volume;
    let N_volume;
    let volObj = {};
    for (let i = 0, len = _data["dataList"][_index]["raw"]["timeDomain"].length; i < len; i++) {
        const sample = _data["dataList"][_index]["raw"]["timeDomain"][i];
        if (sample > peak) {
            peak = sample;
            volume = peak;
            N_volume = volume / 255;
            volObj = { volume, N_volume };
        }
    }
    return volObj;
    // return peak;
}


const bars = [];
const drawRectangle = (_data, _index, _canvas) => {
    const ctx = _canvas.getContext('2d');
    ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    ctx.beginPath();

    let rawData = _data["dataList"][_index]["raw"];
    let timeDomainList = rawData["timeDomain"];
    let peak = getVolumePeak(_data, _index)["volume"];

    let barWidth = 2;
    //let x = canvas.width / dataList.length;
    let barHeight = (1 - (peak / 255)) * _canvas.height;
    ctx.fillStyle = 'rgb(0, 0, 0)';

    //ctx.fillRect(_canvas.width / 2, _canvas.height / 2, barWidth, -((_canvas.height / 2) - barHeight));

    let color = 'rgb(0, 0, 0)';
    if (isRecording) {
        color = 'rgb(0, 255, 0)';
    } else {
        color = 'rgb(0, 0, 0)';
    }

    let velocity = 1;

    debugLog(color);
    pushBar(_canvas.width, _canvas.height / 2, barWidth, -((_canvas.height / 2) - barHeight), velocity, color);
    pushBar(_canvas.width, _canvas.height / 2, barWidth, ((_canvas.height / 2) - barHeight), velocity, color);

    bars.forEach((element) => element.move());
    bars.forEach((element) => element.render(ctx));
    bars.forEach((element) => {
        if (element.x < 0 - barWidth) {
            bars.shift();
        }
    });
    debugLog("bars.length :   " + bars.length);
    debugLog("y : " + barHeight);
}



const pushBar = (x, y, w, h, velocity, color) => {
    bars.push(new Rectangle(x, y, w, h, velocity, color));
}


class Rectangle {
    constructor(x, y, width, height, velocity, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.velocityX = velocity; // この速度で横に移動する。]
        this.color = color;
    }

    move() {
        this.x -= this.velocityX;
    }

    render(context) {
        context.beginPath();
        context.fillStyle = this.color; // 青色

        //context.fillStyle = 'rgb(0, 0, 0)'; // 青色
        context.rect(this.x, this.y, this.width, this.height);
        context.fill();
    }
}



const exportText = (filename, value) => {
    let blob = new Blob([value], { type: "text/plan" });
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
};


// 解析終了
const endRecording = function () {
    isCollecting = false;
    //audioDataをサーバに送信するなど終了処理
};


const debugLog = (text) => {
    //debugLog(text);
}