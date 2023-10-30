const videoInputSelect = document.getElementById("video-input-select");
const audioInputSelect = document.getElementById("audio-input-select");
const startBtn = document.getElementById("start-btn");
const splashScreenIcon = document.querySelector("#splash-screen > i.material-icons");
const splashScreenLoading = document.querySelector("#splash-screen > div > div.preloader-wrapper");
const splashScreenText = document.querySelector("#splash-screen > div > h5");
const splashScreenRefreshButton = document.querySelector("#splash-screen > button");
const videoTab = document.getElementById("video-tab");
const videoTabPreview = document.getElementById("video-tab-preview");
const brightnessSlider = document.getElementById("brightness-slider");
const contrastSlider = document.getElementById("contrast-slider");
const saturationSlider = document.getElementById("saturation-slider");
const videoTabApplyBtn = document.getElementById("video-tab-apply-btn");
const bigPreviewBtn = document.getElementById("big-preview-btn");
const bigPreviewDisplay = document.getElementById("big-preview-display");
const audioVisualizer = document.getElementById("audio-visualizer");
const volumeSlider = document.getElementById("volume-slider");
const loopbackOnBtn = document.getElementById("loopback-on-btn");
const loopbackOffBtn = document.getElementById("loopback-off-btn");
const display = document.getElementById("display");
const displayScreenMenuBtn = document.querySelector("#display-screen > div.fixed-action-btn");
const screenVolumeSlider = document.getElementById("screen-volume-slider");
const exclusionsList = document.querySelector("#exclude-tab > textarea");

// Firefox polyfill
if (typeof MediaStreamTrack.prototype.getCapabilities !== "function") {
    MediaStreamTrack.prototype.getCapabilities = function() {
        return {};
    };
}

valueOrDefault = (value, default_) => value ? value : default_;

function cutObject(obj, keys) {
    const result = {};

    for (const key of keys) {
        if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
    }

    return result;
}

const DEFAULT_RESOLUTION_WIDTH = 1280;
const DEFAULT_RESOLUTION_HEIGHT = 720;

function createInputRadioButton(text, value, group) {
    const p = document.createElement("p");
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.className = "with-gap";
    input.value = value;
    input.name = group;
    label.appendChild(input);
    const span = document.createElement("span");
    span.innerText = text;
    label.appendChild(span);
    p.appendChild(label);

    p.appendChild(document.createElement("br"));

    const copyIdBtn = document.createElement("button");
    copyIdBtn.className = "waves-effect waves-teal btn-flat";
    copyIdBtn.innerHTML = `<i class="material-icons left">content_copy</i> ID`;
    copyIdBtn.onclick = () => navigator.clipboard.writeText(value);
    p.appendChild(copyIdBtn);

    return p;
}

function getValueOfSelectedRadioButtonInGroup(group) {
    const el = document.querySelector(`input[type="radio"][name="${group}"]:checked`);

    return el ? el.value : null;
}

function showNoDevicesErrorModal(text) {
    document.querySelector("#no-devices-modal p").innerText = text;
    M.Modal.getInstance(document.getElementById("no-devices-modal")).open();
}

function changeSplashScreenContent(text, icon, loading, showRefreshButton = false) {
    splashScreenText.innerText = text;
    splashScreenIcon.innerText = icon;
    splashScreenLoading.style.display = loading ? "inline-block" : "none";
    splashScreenRefreshButton.style.visibility = showRefreshButton ? "visible" : "hidden";
}

/** @type {Object<string, MediaStream>} */
const videoStreams = {};

/** @type {Object<string, MediaStream>} */
const audioStreams = {};

class VideoOptions {
    static set(deviceId, options) {
        localStorage.setItem(`videoOptions.${deviceId}`, JSON.stringify(options));
    }

    static get(deviceId) {
        const options = localStorage.getItem(`videoOptions.${deviceId}`);

        return options ? JSON.parse(options) : null;
    }
}

class AudioOptions {
    static set(deviceId, options) {
        localStorage.setItem(`audioOptions.${deviceId}`, JSON.stringify(options));
    }

    static get(deviceId) {
        const options = localStorage.getItem(`audioOptions.${deviceId}`);

        return options ? JSON.parse(options) : null;
    }
}

class SelectedVideoDevice {
    static get deviceId() {
        return getValueOfSelectedRadioButtonInGroup("videoinput");
    }

    static get stream() {
        return videoStreams[this.deviceId];
    }

    static get track() {
        return this.stream.getVideoTracks()[0];
    }
}

class SelectedAudioDevice {
    static get deviceId() {
        return getValueOfSelectedRadioButtonInGroup("audioinput");
    }

    static get stream() {
        return audioStreams[this.deviceId];
    }
}

function switchScreen(targetId) {
    document.querySelector(`body > div:not(.modal)[data-show="1"]`).setAttribute("data-show", "0");
    document.querySelector(`body > div#${targetId}`).setAttribute("data-show", "1");
}

let excludedDevices = [];

{
    const exclusionsString = localStorage.getItem("exclude.devices");

    if (exclusionsString) {
        excludedDevices = JSON.parse(exclusionsString);
        console.table(excludedDevices, ["excluded devices"]);
        exclusionsList.value = excludedDevices.join("\n");
    } else {
        exclusionsList.value = "";
    }
}

/**
 * @param devices {MediaDeviceInfo[]}
 */
async function onGotDevices(devices) {
    const inputs = devices.filter(device =>
        !["default", "communications", ...excludedDevices].includes(device.deviceId) &&
        device.kind !== "audiooutput"
    );
    console.log("onGotDevices inputs: %o", devices);

    if (inputs.length === 0) {
        showNoDevicesErrorModal("Nie wykryto żadnego urządzenia wideo lub audio. Program nie będzie działać.");
        return;
    }

    let videoInputCount = 0;
    let audioInputCount = 0;

    for (const input of inputs) {
        const optionElement = createInputRadioButton(input.label, input.deviceId, input.kind);

        switch (input.kind) {
            case "videoinput":
                let videoStream;

                try {
                    let videoOptions = VideoOptions.get(input.deviceId);

                    const resolution = videoOptions ? videoOptions.resolution : null;
                    videoStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: {exact: input.deviceId},
                            width: {ideal: resolution ? resolution.width : DEFAULT_RESOLUTION_WIDTH},
                            height: {ideal: resolution ? resolution.height : DEFAULT_RESOLUTION_HEIGHT},
                            frameRate: 60
                        },
                        audio: false
                    });
                    const videoTrack = videoStream.getVideoTracks()[0];

                    if (videoOptions === null) {
                        const capabilities = videoTrack.getCapabilities();

                        videoOptions = {
                            brightness: capabilities.hasOwnProperty("brightness") ?
                                Math.round((capabilities.brightness.min + capabilities.brightness.max) / 2)
                                : null,
                            contrast: capabilities.hasOwnProperty("contrast") ?
                                Math.round((capabilities.contrast.min + capabilities.contrast.max) / 2)
                                : null,
                            saturation: capabilities.hasOwnProperty("saturation") ?
                                Math.round((capabilities.saturation.min + capabilities.saturation.max) / 2)
                                : null,
                            resolution: {
                                width: DEFAULT_RESOLUTION_WIDTH,
                                height: DEFAULT_RESOLUTION_HEIGHT
                            }
                        };

                        for (const key of Object.keys(videoOptions)) {
                            if (videoOptions[key] === null) {
                                delete videoOptions[key];
                            }
                        }

                        console.log(`${input.deviceId} capabilities: ${Object.keys(videoOptions).join(", ")}`);
                    } else {
                        const constraints = cutObject(videoOptions, ["brighteness", "contrast", "saturation"]);

                        if (Object.keys(constraints).length > 0) {
                            console.log(`setting ${input.deviceId} constraints: %o`, constraints);
                            await videoTrack.applyConstraints({advanced: [constraints]});
                        }
                    }

                    VideoOptions.set(input.deviceId, videoOptions);
                } catch (e) {
                    console.warn("could not get video stream: %o", e);
                    continue;
                }

                videoStreams[input.deviceId] = videoStream;
                videoInputCount++;
                videoInputSelect.appendChild(optionElement);

                break;
            case "audioinput":
                let audioStream;

                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: {
                            deviceId: {exact: input.deviceId},
                            autoGainControl: false,
                            channelCount: 2,
                            echoCancellation: false,
                            noiseSuppression: false,
                            sampleRate: 48000,
                            sampleSize: 16
                        }
                    });

                    let audioOptions = AudioOptions.get(input.deviceId);

                    if (audioOptions === null) {
                        audioOptions = {
                            volume: 50
                        };
                        AudioOptions.set(input.deviceId, audioOptions);
                    }
                } catch (e) {
                    console.warn("could not get audio stream: %o", e);
                    continue;
                }

                audioStreams[input.deviceId] = audioStream;
                audioInputCount++;
                audioInputSelect.appendChild(optionElement);

                break;
        }
    }

    if (videoInputCount === 0) {
        showNoDevicesErrorModal("Nie wykryto żadnego urządzenia wideo. Program nie będzie działać.");
        return;
    } else if (audioInputCount === 0) {
        showNoDevicesErrorModal("Nie wykryto żadnego urządzenia audio. Program nie będzie działać.");
        return;
    }

    document.querySelector(`#input-tab > #video-input-select > p:nth-of-type(1) > label > input`).checked = true;
    document.querySelector(`#input-tab > #audio-input-select > p:nth-of-type(1) > label > input`).checked = true;

    startBtn.removeAttribute("disabled");
}

document.querySelector(`#config-screen .tabs a[href="#input-tab"]`).parentElement.onclick = () => {
    setAudioLoopbackState(false);
}

function initSlider(sliderElement, min = 0, max = 1, step = 1) {
    noUiSlider.create(sliderElement, {
        start: 0,
        connect: "lower",
        range: {min, max},
        step,
        format: {
            to(value) {
                return Math.round(value).toString();
            },
            from(value) {
                return parseInt(value);
            }
        }
    });
}

function updateSlider(sliderElement, min, max, step, current) {
    sliderElement.noUiSlider.updateOptions({
        range: {min, max},
        step,
        start: current
    });
}

function getSliderValue(sliderElement) {
    return parseInt(sliderElement.noUiSlider.get());
}

document.querySelector(`#config-screen .tabs a[href="#video-tab"]`).parentElement.onclick = () => {
    setAudioLoopbackState(false);

    const options = VideoOptions.get(SelectedVideoDevice.deviceId);
    const capabilites = SelectedVideoDevice.track.getCapabilities();

    if ("brightness" in options && "brightness" in capabilites) {
        brightnessSlider.removeAttribute("disabled");
        updateSlider(brightnessSlider, capabilites.brightness.min, capabilites.brightness.max, capabilites.brightness.step, options.brightness);
    } else {
        brightnessSlider.setAttribute("disabled", "disabled");
    }

    if ("contrast" in options && "contrast" in capabilites) {
        contrastSlider.removeAttribute("disabled");
        updateSlider(contrastSlider, capabilites.contrast.min, capabilites.contrast.max, capabilites.contrast.step, options.contrast);
    } else {
        contrastSlider.setAttribute("disabled", "disabled");
    }

    if ("saturation" in options && "saturation" in capabilites) {
        saturationSlider.removeAttribute("disabled");
        updateSlider(saturationSlider, capabilites.saturation.min, capabilites.saturation.max, capabilites.saturation.step, options.saturation);
    } else {
        saturationSlider.setAttribute("disabled", "disabled");
    }

    videoTabPreview.srcObject = SelectedVideoDevice.stream;
    videoTabPreview.play();
    bigPreviewDisplay.srcObject = SelectedVideoDevice.stream;
    bigPreviewDisplay.play();
};

videoTabApplyBtn.onclick = () => {
    const capabilites = SelectedVideoDevice.track.getCapabilities();
    const options = {};

    if ("brightness" in capabilites) {
        options.brightness = getSliderValue(brightnessSlider);
    }

    if ("contrast" in capabilites) {
        options.contrast = getSliderValue(contrastSlider);
    }

    if ("saturation" in capabilites) {
        options.saturation = getSliderValue(saturationSlider);
    }

    VideoOptions.set(SelectedVideoDevice.deviceId, options);
    M.toast({ html: "Zapisano preferencje wideo dla tego urządzenia.", displayLength: 2000 });

    SelectedVideoDevice.track.applyConstraints({advanced: [options]});
};

bigPreviewBtn.onclick = () => {
    if (videoTab.getAttribute("data-floating") === "0") {
        videoTab.setAttribute("data-floating", "1");
        bigPreviewBtn.innerHTML = `<i class="material-icons left">fullscreen_exit</i> Opuść duży podgląd`;
        bigPreviewDisplay.style.display = "block";
    } else {
        videoTab.setAttribute("data-floating", "0");
        bigPreviewBtn.innerHTML = `<i class="material-icons left">fullscreen</i> Duży podgląd`;
        bigPreviewDisplay.style.display = "none";
    }

    bigPreviewBtn.blur();
};

/** @type {AudioContext} */
let audioCtx = null;

document.querySelector(`#config-screen .tabs a[href="#audio-tab"]`).parentElement.onclick = () => {
    const options = AudioOptions.get(SelectedAudioDevice.deviceId);
    updateSlider(volumeSlider, 0, 100, 1, options.volume);
    audioLoopbackPlayer.volume = options.volume / 100;

    // visualizer
    const canvasCtx = audioVisualizer.getContext("2d");
    const width = audioVisualizer.width;
    const height = audioVisualizer.height;

    if (!audioCtx) audioCtx = new AudioContext();

    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(SelectedAudioDevice.stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    canvasCtx.clearRect(0, 0, width, height);

    const draw = () => {
        requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = "rgb(255, 255, 255)";
        canvasCtx.fillRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;

            canvasCtx.fillStyle = `rgb(38, 166, 154)`;
            canvasCtx.fillRect(x, height - barHeight / 2, barWidth, barHeight);

            x += barWidth + 1;
        }
    };

    draw();
}

const audioLoopbackPlayer = new Audio();

function setAudioLoopbackState(enabled) {
    if (enabled) {
        audioLoopbackPlayer.srcObject = SelectedAudioDevice.stream;
        audioLoopbackPlayer.play();
        loopbackOnBtn.style.display = "none";
        loopbackOffBtn.style.display = "block";
    } else {
        audioLoopbackPlayer.pause();
        loopbackOffBtn.style.display = "none";
        loopbackOnBtn.style.display = "block";
    }
}

loopbackOnBtn.onclick = () => setAudioLoopbackState(true);
loopbackOffBtn.onclick = () => setAudioLoopbackState(false);

startBtn.onclick = () => {
    setAudioLoopbackState(false);
    const audioOptions = AudioOptions.get(SelectedAudioDevice.deviceId);
    screenVolumeSlider.noUiSlider.set(audioOptions.volume);
    switchScreen("display-screen");

    const stream = SelectedVideoDevice.stream.clone();
    for (let audioTrack of SelectedAudioDevice.stream.getAudioTracks()) {
        stream.addTrack(audioTrack);
    }

    display.srcObject = stream;
    display.volume = audioOptions.volume / 100;
    display.play();
};

exclusionsList.oninput = () => {
    localStorage.setItem("exclude.devices", JSON.stringify(exclusionsList.value.trim().split("\n")));
};

(async function() {
    let tempStream;

    try {
        changeSplashScreenContent("Zezwól na dostęp do kamery i mikrofonu", "gpp_good", false);
        console.log("initial getUserMedia");
        tempStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        console.log("tempStream: %o", tempStream);
        changeSplashScreenContent("Skanowanie urządzeń...", "search", true);
    } catch (e) {
        console.error(e);
        changeSplashScreenContent("Nie odnaleziono żadnych urządzeń wideo lub audio", "error", false, true);
        return;
    }

    tempStream.getTracks().forEach(track => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    M.AutoInit(document.body);
    await onGotDevices(devices);

    console.log("init materialize css");
    M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'), {
        direction: "left",
        hoverEnabled: false
    });
    M.Tooltip.init( document.querySelectorAll('.tooltipped'), {
        exitDelay: 0
    });
    initSlider(brightnessSlider);
    initSlider(contrastSlider);
    initSlider(saturationSlider);
    initSlider(volumeSlider, 0, 100);
    initSlider(screenVolumeSlider, 0, 100);

    let displayScreenMenuBtnTimeout;
    let displayScreenMenuBtnJustHidden = false;
    document.getElementById("display-screen").onmousemove = () => {
        console.log(1);
        if (!displayScreenMenuBtnJustHidden) {
            displayScreenMenuBtnJustHidden = false;
            clearTimeout(displayScreenMenuBtnTimeout);
            displayScreenMenuBtn.classList.remove("hidden");
            displayScreenMenuBtnTimeout = setTimeout(() => {
                displayScreenMenuBtn.classList.add("hidden");
            }, 750);
        }
    }

    volumeSlider.noUiSlider.on("set", values => {
        AudioOptions.set(SelectedAudioDevice.deviceId, {volume: values[0]});
        audioLoopbackPlayer.volume = values[0] / 100;
    });

    screenVolumeSlider.noUiSlider.on("set", values => {
        AudioOptions.set(SelectedAudioDevice.deviceId, {volume: values[0]});
        display.volume = values[0] / 100;
    });

    for (let sliderWrapper of document.getElementsByClassName("slider-wrapper")) {
        const sliderLabel = sliderWrapper.getElementsByTagName("label")[1];
        sliderWrapper.getElementsByTagName("div")[0].noUiSlider.on("set.updateLabel", values => {
            sliderLabel.innerText = values[0];
        });
    }

    document.querySelectorAll(`body > div:not(.modal)[data-show="1"]`).forEach((screenElement, index) => screenElement.setAttribute("data-show", index === 0 ? "1" : "0"));
    switchScreen("config-screen");
})();
