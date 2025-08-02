export const AudioUtil = {
    audioBufferEmpty() {
        const emptyLength = 1024 * 100;
        const buffer = new AudioBuffer({
            length: emptyLength,
            numberOfChannels: 2,
            sampleRate: 8000,
        });
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < emptyLength; i++) {
                data[i] = 0;
            }
        }
        return buffer;
    },
    audioBufferCut(buffer: AudioBuffer, start: number, end: number) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const startOffset = Math.floor(start * sampleRate);
        const endOffset = Math.floor(end * sampleRate);
        const targetLength = endOffset - startOffset;
        const targetBuffer = new AudioBuffer({
            length: targetLength,
            numberOfChannels: numChannels,
            sampleRate: sampleRate,
        });
        for (let channel = 0; channel < numChannels; channel++) {
            const sourceChannel = buffer.getChannelData(channel);
            const targetChannel = targetBuffer.getChannelData(channel);
            for (let i = 0; i < targetLength; i++) {
                targetChannel[i] = sourceChannel[startOffset + i];
            }
        }
        return targetBuffer;
    },
    audioBufferConvert(buffer: AudioBuffer, targetSampleRate: number, targetChannelNum: number) {
        targetChannelNum = targetChannelNum || buffer.numberOfChannels;
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const targetLength = Math.floor((length * targetSampleRate) / sampleRate);
        const targetBuffer = new AudioBuffer({
            length: targetLength,
            numberOfChannels: targetChannelNum,
            sampleRate: targetSampleRate,
        });
        for (let channel = 0; channel < targetChannelNum; channel++) {
            const sourceChannel = buffer.getChannelData(channel % numChannels);
            const targetChannel = targetBuffer.getChannelData(channel);
            for (let i = 0; i < targetLength; i++) {
                const sourceIndex = Math.floor((i * sampleRate) / targetSampleRate);
                targetChannel[i] = sourceChannel[sourceIndex];
            }
        }
        return targetBuffer;
    },
    audioBufferToWav(buffer: AudioBuffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataSize = buffer.length * blockAlign;
        const view = new DataView(new ArrayBuffer(44 + dataSize));
        view.setUint32(0, 1380533830, false);
        view.setUint32(4, 44 + dataSize - 8, true);
        view.setUint32(8, 1463899717, false);
        view.setUint32(12, 1718449184, false);
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        view.setUint32(36, 1635017060, true);
        view.setUint32(40, dataSize, true);
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = buffer.getChannelData(channel)[i];
                const intSample = Math.max(-1, Math.min(1, sample));
                view.setInt16(offset, Math.round(intSample < 0 ? intSample * 0x8000 : intSample * 0x7fff), true);
                offset += 2;
            }
        }
        return new Uint8Array(view.buffer);
    },
    audioBufferToWavBlob(buffer: AudioBuffer) {
        return new Blob([this.audioBufferToWav(buffer)], {type: "audio/wav"});
    },
    fileToAudioBuffer(file: File) {
        return new Promise<AudioBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;
                const context = new AudioContext();
                context.decodeAudioData(arrayBuffer, resolve, reject);
            };
            reader.readAsArrayBuffer(file);
        });
    },
    parseAudioFile(file: File) {
        return new Promise<{
            duration: number;
            sampleRate: number;
            numberOfChannels: number;
        }>((resolve, reject) => {
            this.fileToAudioBuffer(file)
                .then(buffer => {
                    resolve({
                        duration: buffer.duration,
                        sampleRate: buffer.sampleRate,
                        numberOfChannels: buffer.numberOfChannels,
                    });
                })
                .catch(reject);
        });
    },
};
