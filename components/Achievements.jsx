"use client";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import styles from "./Achievements.module.css";

export default function Achievements() {
  const [sliderRef] = useKeenSlider({
    mode: "free-snap",

    breakpoints: {
      "(min-width: 768px)": {
        slides: { perView: 2, spacing: 30 },
      },
      "(min-width: 1024px)": {
        slides: { perView: 2, spacing: 30 },
      },
      "(min-width: 1280px)": {
        slides: { perView: 3, spacing: 30 },
      },
    },
    slides: { perView: 1, spacing: 30 },
  });
  const achievements = [
    {
      year: 2025,
      gradient:
        "linear-gradient(150deg, rgba(255,255,255,1) 0%, rgba(0,0,0,0.1) 90%)",
      results: [{ title: "", link: "" }],
    },
    {
      year: 2024,
      gradient:
        "linear-gradient(150deg, rgba(255,255,255,1) 0%, rgba(0,0,0,0.1) 90%)",
      results: [{ title: "", link: "" }],
    },
    {
      year: 2023,
      gradient:
        "linear-gradient(150deg, rgba(255,255,255,1) 0%, rgba(0,0,0,0.1) 90%)",
      results: [{ title: "", link: "" }],
    },
    {
      year: 2022,
      gradient:
        "linear-gradient(150deg, rgba(255,255,255,1) 0%, rgba(0,0,0,0.1) 90%)",
      results: [{ title: "", link: "" }],
    },
  ];
  return (
    <div ref={sliderRef} className="keen-slider pt-8 pb-2">
      {achievements.map((slide, index) => (
        <div
          key={index}
          className={`shadow-[0px_0px_5px_1px_rgba(150,150,150,0.7)] rounded-xl keen-slider__slide ${styles.slideCommon}`}
          style={{ background: slide.gradient }}
        >
          <span className="font-light">{slide.year}</span>
        </div>
      ))}
    </div>
  );
}
