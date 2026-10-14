export function connectSlider(root, { inputSelector, outputSelector }) {
  const input = root.querySelector(inputSelector);
  const output = root.querySelector(outputSelector);
  if (!input || !output) throw new Error("Slider input or output element is missing.");
  const number = root.querySelector("[data-slider-number]");
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const update = (source = input) => {
    const value = Math.max(min, Math.min(max, Number(source.value)));
    input.value = String(value);
    if (number) number.value = String(value);
    output.textContent = `${value}${input.dataset.suffix ?? "%"}`;
    input.style.setProperty("--range-progress", `${max === min ? 0 : ((value - min) / (max - min)) * 100}%`);
  };
  const onRangeInput = () => update(input);
  const onNumberInput = () => { if (number.value !== "") update(number); };
  const onNumberChange = () => update(number);
  input.addEventListener("input", onRangeInput);
  number?.addEventListener("input", onNumberInput);
  number?.addEventListener("change", onNumberChange);
  update();
  return () => {
    input.removeEventListener("input", onRangeInput);
    number?.removeEventListener("input", onNumberInput);
    number?.removeEventListener("change", onNumberChange);
  };
}
