# MeshInk

MeshInk is a real-time, collaborative whiteboard application featuring an infinite canvas. It allows multiple users to draw together seamlessly, with features designed for a smooth and intuitive experience.

## Features

- **Infinite Canvas:** Pan and zoom on an endless canvas, providing limitless space for your ideas.
- **Real-Time Collaboration:** Powered by Ably, all drawings are synced with other users in real-time.
- **Drawing Tools:** Switch between a pen and an eraser, with adjustable stroke widths and a full-color picker.
- **Dynamic Grid:** Toggle a dynamic grid to help with alignment and perspective.
- **Customization:** Switch between light and dark themes to suit your preference.
- **Session Control:** A "Clear Canvas" button allows you to reset the drawing board for everyone.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **UI Library:** [React](https://reactjs.org/)
- **Canvas:** [Konva.js](https://konvajs.org/)
- **Real-time:** [Ably](https://ably.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/PawiX25/MeshInk.git
    cd MeshInk
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the `MeshInk` directory by copying the example:

    ```sh
    cp .env.local.example .env.local
    ```

    You will need to add your Ably API key to this file. You can get one for free by signing up at [ably.com](https://ably.com/).

    ```
    ABLY_API_KEY="your-ably-api-key"
    ```

4.  **Run the development server:**
    ```sh
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.