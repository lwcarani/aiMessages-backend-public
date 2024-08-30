# Overview

In March of 2023, I partnered with my good friend [Jake Taylor](https://github.com/jakee417/) to build an iOS App that did two things:
1. Bring the ChatGPT "Large Language Model" (LLM) experience to iMessage (both in private and group chats)
2. Allow users to generate photo-realistic images with generative AI via an iMessage Extension App

In our infinite cleverness, we named this app ["aiMessages"](https://sites.google.com/view/aimessagesapp/home). We launched on the Apple App Store June 2023 and at the time of writing this post (May 2024) it is still available for [download](https://apps.apple.com/us/app/aimessages/id6446336518).

# Tech Stack

There are a lot of boilerplate Firebase files included in the repo; most of the relevant server-side code can be found in [functions/src/index.ts](https://github.com/lwcarani/aiMessages-backend-public/blob/main/functions/src/index.ts) along with the referenced imports. 

For scalability, we chose to use [Firebase](https://firebase.google.com/), an app development platform backed by Google. We integrated [RevenueCat](https://www.revenuecat.com/) to simplify user payments, which was much simpler than using the `StoreKit` API. For sending LLM / ChatGPT responses back to users via iMessage, we used [LoopMessage](https://loopmessage.com/server), an iMessage API for sending blue text messages to iMessage users. For generating photo-realistic images with generative AI, we used [StabilityAI's](https://stability.ai/) stable diffusion text-to-image and inpainting models, and [Clipdrop's](https://clipdrop.co/) sketch-to-image model. For the AI chatbot / LLM experience, we used [OpenAI's](https://chatgpt.com/) ChatGPT model. Finally, we decided to use Google Cloud Functions (which are integrated into Firebase) to develop and deploy our serverless execution environment, and subsequently all of our backend code is written in [Typescript](https://www.typescriptlang.org/). I will discuss each of these technologies / APIs in more detail in later blog posts.

I learned so many valuable lessons and techniques relevant to software engineering by working on this app over the last year. 
- I got a lot of practice writing really robust, defensive code, trying to think through every edge case for every user action I might have to handle. 
- I gained exposure to and experience in test-driven development (TDD), writing hundreds and hundreds of unit tests. 
- Idempotent coding was a new concept for me, and I got to implement idempotent code to ensure we didn't double-charge users for their purchases. 
- I learned how to use bearer tokens with our cloud functions to authenticate incoming [webhooks](https://www.redhat.com/en/topics/automation/what-is-a-webhook). 
- I used NoSQL databases for the first time (which I really enjoyed), and now better understand the trade-offs between traditional, relational databases and NoSQL. 
- I got to work closely with Jake, communicating daily to work on how the client and server systems would communicate and work together in a seamless way to handle iMessage, data storage and retrieval, client authentication, and the like. 
- I had to think strategically about deploying code and adding new features in a way that maintained reverse compatability with the frontend app versions: making sure that backend upgrades wouldn't break functionality for users on old versions of the iOS app, while allowing users who downloaded the new version of the iOS app to benefit from new backend features. 
- I had to consider the trade-offs of building for long-term scalability with growing more users (and managing a huge server load) with just shipping a product "now" before we had any users, but that we knew was ready to deploy. 
- And finally, I learned that you don't always have to write perfectly modularized, abstract, reusable, clean code, sometimes it just has to work (especially if the backend dev team is just one person).

A more in-depth review of our tech stack is covered in a series of blog posts I wrote, which can be found [here](https://lwcarani.github.io/).
