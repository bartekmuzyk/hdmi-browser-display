const videoInputSelect = document.getElementById("video-input-select");
const audioInputSelect = document.getElementById("audio-input-select");
const startBtn = document.getElementById("start-btn");
const splashScreenIcon = document.querySelector("#splash-screen > i.material-icons");
const splashScreenLoading = document.querySelector("#splash-screen > div > div.preloader-wrapper");
const splashScreenText = document.querySelector("#splash-screen > div > h5");
const splashScreenRefreshButton = document.querySelector("#splash-screen > button");
const videoTabPreview = document.getElementById("video-tab-preview");
const brightnessSlider = document.getElementById("brightness-slider");
const contrastSlider = document.getElementById("contrast-slider");
const saturationSlider = document.getElementById("saturation-slider");
const videoTabApplyBtn = document.getElementById("video-tab-apply-btn");

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

    return p;
}

function getValueOfSelectedRadioButtonInGroup(group) {
    return document.querySelector(`input[type="radio"][name="${group}"]:checked`)?.value ?? null;
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

class SelectedVideoDevice {
    static get deviceId() {
        return getValueOfSelectedRadioButtonInGroup("videoinput");
    }

    static get stream() {
        return videoStreams[this.deviceId];
    }

    static get capabilites() {
        return this.stream.getVideoTracks()[0].getCapabilities();
    }
}

function getSelectedAudioDeviceId() {
    return getValueOfSelectedRadioButtonInGroup("audioinput");
}

function getAudioStreamOfSelectedDevice() {
    return audioStreams[getSelectedAudioDeviceId()];
}

function switchScreen(targetId) {
    document.querySelector(`body > div:not(.modal)[data-show="1"]`).setAttribute("data-show", "0");
    document.querySelector(`body > div#${targetId}`).setAttribute("data-show", "1");
}

/**
 * @param devices {MediaDeviceInfo[]}
 */
async function onGotDevices(devices) {
    const inputs = devices.filter(device => device.deviceId !== "default" && device.kind !== "audiooutput");
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
                videoInputCount++;
                videoInputSelect.appendChild(optionElement);

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: {exact: input.deviceId},
                        width: {exact: 1280},
                        height: {exact: 720},
                        frameRate: 60
                    },
                    audio: false
                });

                const videoTrack = stream.getVideoTracks()[0];
                let options = VideoOptions.get(input.deviceId);

                if (options === null) {
                    const capabilities = videoTrack.getCapabilities();

                    options = {
                        brightness: capabilities.hasOwnProperty("brightness") ?
                            Math.round((capabilities.brightness.min + capabilities.brightness.max) / 2)
                            : null,
                        contrast: capabilities.hasOwnProperty("contrast") ?
                            Math.round((capabilities.contrast.min + capabilities.contrast.max) / 2)
                            : null,
                        saturation: capabilities.hasOwnProperty("saturation") ?
                            Math.round((capabilities.saturation.min + capabilities.saturation.max) / 2)
                            : null,
                    };
                    for (const key of Object.keys(options)) {
                        if (options[key] === null) {
                            delete options[key];
                        }
                    }

                    VideoOptions.set(input.deviceId, options);
                } else {
                    if (Object.keys(options).length > 0) {
                        await videoTrack.applyConstraints({advanced: [options]});
                    }
                }

                videoStreams[input.deviceId] = stream;

                break;
            case "audioinput":
                audioInputCount++;
                audioInputSelect.appendChild(optionElement);

                audioStreams[input.deviceId] = await navigator.mediaDevices.getUserMedia({
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

function initSlider(sliderElement) {
    noUiSlider.create(sliderElement, {
        start: 0,
        connect: "lower",
        range: {
            min: 0,
            max: 1
        },
        step: 1,
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

document.querySelector(`#config-screen .tabs a[href="#video-tab"]`).parentElement.onclick = () => {
    const options = VideoOptions.get(SelectedVideoDevice.deviceId);
    const capabilites = SelectedVideoDevice.capabilites;

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
};

videoTabApplyBtn.onclick = () => {
    const capabilites = SelectedVideoDevice.capabilites;


};

(async function() {
    let tempStream;

    try {
        changeSplashScreenContent("Zezwól na dostęp do kamery i mikrofonu", "gpp_good", false);
        tempStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        console.log("tempStream: %o", tempStream);
        changeSplashScreenContent("Skanowanie urządzeń...", "search", true);
    } catch (e) {
        changeSplashScreenContent("Nie odnaleziono żadnych urządzeń wideo lub audio", "error", false, true);
        return;
    }

    tempStream.getTracks().forEach(track => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    await onGotDevices(devices);

    M.AutoInit(document.body);
    initSlider(brightnessSlider);
    initSlider(contrastSlider);
    initSlider(saturationSlider);

    document.querySelectorAll(`body > div:not(.modal)[data-show="1"]`).forEach((screenElement, index) => screenElement.setAttribute("data-show", index === 0 ? "1" : "0"));
    switchScreen("config-screen");
})();
