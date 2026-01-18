import "./embla.css"

import React, { useEffect } from "react"
// import { EmblaOptionsType } from "embla-carousel"
import { DotButton, useDotButton } from "./EmblaCarouselDotButton"
import useEmblaCarousel from "embla-carousel-react"
import Kbd from "./Kbd"

export interface TipItem {
  content: React.ReactNode
}

interface TipsCarouselProps {
  tips?: TipItem[]
}

const TipsCarousel: React.FC<TipsCarouselProps> = ({ tips: propTips }) => {
  const isMacOS =
    typeof window !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const modKey = isMacOS ? "Cmd" : "Ctrl"
  const altKey = isMacOS ? "Option" : "Alt"

  const defaultTips: TipItem[] = [
    {
      content: (
        <>
          When you have selected a row, press:
          <ul>
            <li>
              <Kbd>Enter</Kbd> to copy to clipboard
            </li>
            <li>
              <Kbd>{modKey}</Kbd> + <Kbd>Enter</Kbd> to copy as JSON
            </li>
          </ul>
        </>
      ),
    },
    {
      content: (
        <>
          Click on a value in the inspector to filter for rows matching that
          value.
          <ul>
            <li>
              Hold <Kbd>{modKey}</Kbd> to filter for many
            </li>
            <li>
              Hold <Kbd>{altKey}</Kbd> to exclude
            </li>
          </ul>
        </>
      ),
    },
    {
      content:
        "You can drop a transform file onto data to apply the transformers.",
    },
    {
      content:
        "You can drop/select multiple files of the same shape to read all at once (will be concatenated).",
    },
    {
      content: (
        <>
          <Kbd>{modKey}</Kbd> click on a value to copy it to the clipboard.
        </>
      ),
    },
    {
      content: (
        <>
          Value color indicates its data type.<br></br>Hover to see details.
        </>
      ),
    },
  ]

  const tips = propTips || defaultTips
  const slides = Array.from(Array(tips.length).keys())
  const [emblaRef, emblaApi] = useEmblaCarousel({})

  const { selectedIndex, scrollSnaps, onDotButtonClick } =
    useDotButton(emblaApi)

  // Select a random tip on very first render only (without animation)
  useEffect(() => {
    if (emblaApi) {
      const randomIndex = Math.floor(Math.random() * tips.length)
      emblaApi.scrollTo(randomIndex, true)
    }
  }, [emblaApi, tips.length])

  return (
    <section data-testid="tips-carousel" className="embla">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {slides.map((index) => (
            <div className="embla__slide" key={index}>
              <div className="embla__slide__number">
                <div className="mx-4">
                  <div className="text-xl text-gray-500 mb-4">
                    💡 Tip #{index + 1}
                  </div>
                  <div className="text-md text-gray-500 leading-6">
                    {tips[index].content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="embla__controls">
        {/* <div className="embla__buttons">
          <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
          <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
        </div> */}

        <div className="embla__dots">
          {scrollSnaps.map((_, index) => (
            <DotButton
              key={index}
              onClick={() => onDotButtonClick(index)}
              className={"embla__dot".concat(
                index === selectedIndex ? " embla__dot--selected" : "",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default TipsCarousel
