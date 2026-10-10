# The arm on the landing page

`arm.glb`, `arm.edges.bin` and `arm.json` are a simplified copy of the SO-101 robot arm
in `examples/arm`. The arm is not Enclose's: it is by TheRobotStudio, with Hugging
Face's LeRobot, from <https://github.com/TheRobotStudio/SO-ARM100>, under the Apache
License, Version 2.0 (see `examples/arm/source/README.md` and the `LICENSE` beside it).

What is changed from the original: the surfaces and edge lines were simplified, the
smallest parts on the circuit board were drawn as boxes, and the whole was repacked for
the web. `scripts/pack-model.mjs` does all of it; run it again to remake these files.
