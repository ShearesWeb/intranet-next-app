"use client";

import { useEffect, useRef } from "react";

export function useRecapAudio(audioPath = "/audio/sheares.mp3") {
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		const audio = new Audio(audioPath);
		audio.preload = "auto";
		audioRef.current = audio;

		return () => {
			audio.pause();
			audio.currentTime = 0;
			audioRef.current = null;
		};
	}, [audioPath]);

	const playRecapAudio = () => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = 0;
		void audio.play().catch(() => {
			// Ignore playback failures caused by browser/device policies.
		});
	};

	const stopRecapAudio = () => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.pause();
		audio.currentTime = 0;
	};

	return { playRecapAudio, stopRecapAudio };
}
