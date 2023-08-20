M.AutoInit(document.body);

const videoInputSelect = document.getElementById("video-input-select");
const audioInputSelect = document.getElementById("audio-input-select");
const devicesLoadingSpinner = document.getElementById("devices-loading-spinner");
const startBtn = document.getElementById("start-btn");

function showNoDevicesErrorModal(text) {
    document.querySelector("#no-devices-modal p").innerText = text;
    M.Modal.getInstance(document.getElementById("no-devices-modal")).open();
}

/**
 * @param devices {InputDeviceInfo[]}
 */
function onGotDevices(devices) {
    const inputs = devices.filter(device => device.deviceId !== "default" && device.kind !== "audiooutput");
    console.log(inputs);

    if (inputs.length === 0) {
        showNoDevicesErrorModal("Nie wykryto żadnego urządzenia wideo lub audio. Program nie będzie działać.");
        return;
    }

    let videoInputCount = 0;
    let audioInputCount = 0;

    for (const input of inputs) {
        const optionElement = document.createElement("option");
        optionElement.value = input.deviceId;
        optionElement.innerText = input.label;

        switch (input.kind) {
            case "videoinput":
                videoInputCount++;
                videoInputSelect.appendChild(optionElement);
                break;
            case "audioinput":
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

    startBtn.removeAttribute("disabled");
}

navigator.mediaDevices.enumerateDevices()
    .then(onGotDevices)
    .finally(() => {
        devicesLoadingSpinner.classList.remove("active");
    });
