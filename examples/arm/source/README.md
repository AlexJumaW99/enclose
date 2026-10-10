# Where this is from

`SO101 Assembly.step` is the assembly of the SO-101 robot arm, by TheRobotStudio in
collaboration with Hugging Face's LeRobot. It is not Enclose's.

- the project: <https://github.com/TheRobotStudio/SO-ARM100>
- the file there: `STEP/SO101/SO101 Assembly.step`
- as of commit `a758567c3978dfeefe282ede0500085a48fe8f78`
- its SHA-256: `f754be35708382b05ce65768ae33c612f91dca11ad19d14807dc637eb944ba3d`

It is here as it is published, unchanged. To have a newer one, put it in this file's
place and build the model again: `model.py` goes by the names the file gives its parts.

## Its licence

The SO-ARM100 project is under the Apache License, Version 2.0, and so is this file.
`LICENSE`, beside this, is the project's own copy of it. Its authors ask to be cited as
the project's `CITATION.cff` says: "Standard Open SO-100 & SO-101 Arms", Rob Knight and
others, 2024.

The assembly has in it the models of the parts the arm is built from that are bought
and not printed: six Feetech STS3215 servos, a Waveshare bus servo adapter board, and
the screws. They are in the file as its makers put them there.

## What is Enclose's

`model.py` and `tools/arm.js`, one folder up, were written for this example: the first
says which link of the arm each body in the file is part of, the second steers the arm
joint by joint. Neither is part of SO-ARM100, and nothing in the file is redrawn.
