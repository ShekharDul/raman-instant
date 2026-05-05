import { ValidationSuite } from './src/engine/validation/validation_suite.ts';

async function main() {
  try {
    await ValidationSuite.run();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
