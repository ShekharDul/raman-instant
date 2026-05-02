import { levenbergMarquardt } from 'ml-levenberg-marquardt';

const x = [1, 2, 3, 4, 5];
const y = [2, 4, 6, 8, 10]; // Line y = 2x

function model([m, c]: number[]) {
  return (xVal: number) => m * xVal + c;
}

const options = {
  initialValues: [1, 1], // Start with m=1, c=1
};

const result = levenbergMarquardt({ x, y }, model, options);
console.log("Keys in result object:", Object.keys(result));
console.log("Parameter Errors (if any):", (result as any).parameterError);
console.log("Full Result:", JSON.stringify(result, null, 2));
