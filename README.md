# Overview

In March of 2023, I partnered with my good friend [Jake Taylor](https://github.com/jakee417/) to build an iOS App that did two things:
1. Bring the ChatGPT "Large Language Model" (LLM) experience to iMessage (both in private and group chats)
2. Allow users to generate photo-realistic images with generative AI via an iMessage Extension App

In our infinite cleverness, we named this app ["aiMessages"](https://sites.google.com/view/aimessagesapp/home). We launched on the Apple App Store June 2023 and at the time of writing this (May 2024) it is still available for [download](https://apps.apple.com/us/app/aimessages/id6446336518).

# Tech Stack

For scalability, we chose to use [Firebase](https://firebase.google.com/), an app development platform backed by Google. We integrated [RevenueCat](https://www.revenuecat.com/) to simplify user payments, which was much simpler than using the `StoreKit` API. For sending LLM / ChatGPT responses back to users via iMessage, we used [LoopMessage](https://loopmessage.com/server), an iMessage API for sending blue text messages to iMessage users. For generating photo-realistic images with generative AI, we used [StabilityAI's](https://stability.ai/) stable diffusion text-to-image and inpainting models, and [Clipdrop's](https://clipdrop.co/) sketch-to-image model. For the AI chatbot / LLM experience, we used [OpenAI's](https://chatgpt.com/) ChatGPT model. Finally, we decided to use Google Cloud Functions (which are integrated into Firebase) to develop and deploy our serverless execution environment. All of our backend code is written in [Typescript](https://www.typescriptlang.org/).

A more in-depth review of our tech stack is covered in a series of blog posts I wrote, which can be found [here](https://lwcarani.github.io/).
