# ResortIQ - Hospitality Intelligence

Active Intelligence Dashboard for Hospitality. Features Funnel Lab, Segment Studio, and AI-driven forensic revenue analysis powered by Google Gemini AI.

## Features

- 🔬 **Funnel Lab** - Analyze booking funnels and identify drop-off points
- 👥 **Segment Studio** - Understand customer segments and behaviors  
- 🔍 **Friction Forensic** - Detect and resolve user experience friction
- 🤖 **AskAI Analyst** - AI-powered revenue insights and recommendations

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **Google Gemini API Key** - Get one at [Google AI Studio](https://makersuite.google.com/app/apikey)

## Getting Started

1. **Clone the repository** (if you haven't already)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   Create a `.env.local` file in the root directory:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```
   
   Or copy the example file:
   ```bash
   cp env.example .env.local
   ```
   Then edit `.env.local` and add your Gemini API key.

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   
   Navigate to `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling (via inline classes)
- **Recharts** - Data visualization
- **Google Gemini AI** - AI-powered insights
- **Lucide React** - Icons

## Project Structure

```
├── components/          # React components
│   ├── AskAISidebar.tsx    # AI chat interface
│   ├── FunnelLab.tsx       # Funnel analysis
│   ├── SegmentStudio.tsx   # Segment analysis
│   └── FrictionForensic.tsx # Friction detection
├── services/           # API services
│   └── geminiService.ts    # Gemini AI integration
├── App.tsx            # Main app component
├── types.ts           # TypeScript types
└── vite.config.ts     # Vite configuration
```

## Configuration

The app uses environment variables for configuration. See `.env.local.example` for available options.

## License

MIT
