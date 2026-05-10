# AgriBud - AI-Powered Crop Disease Diagnosis & Treatment

AgriBud is a professional, nature-inspired AI assistant designed specifically for Indian farmers. It leverages state-of-the-art AI to provide instant, scientifically grounded crop disease diagnosis and actionable treatment plans.

## 🌿 Key Features

### 🔍 Precision Diagnosis
*   **Multimodal Input**: Capture leaf photos or record short videos of your crops directly within the app.
*   **Gemini 2.5 Flash Integration**: Powered by the latest AI model for high-speed, accurate reasoning.
*   **Search Grounding**: Every AI response is verified against real-time agricultural databases and government portals to ensure zero-hallucination and up-to-date safety regulations.

### 📸 In-App Hardware Integration
*   **Custom WebRTC Camera**: A true in-app viewfinder with built-in focus guides, bypassing inconsistent system file pickers.
*   **Video Recording**: Record field-level plot assessments using the integrated video recorder.
*   **Speech-to-Text (STT)**: Describe symptoms in your native language using the pulsing "Listen" interface.

### 🌍 Accessibility & Localization
*   **Multilingual UI**: The entire interface can be switched instantly between **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)**.
*   **Native AI Responses**: AI automatically responds in the language of your choice or matches the language of your prompt.

### 📊 Farmer-Centric Workflow
*   **Plot Management**: Add and track multiple crops with details like sowing date and GPS-based location.
*   **Diagnosis History**: Securely save every conversation and diagnosis per crop for future reference.
*   **Compact UI**: Professional "Forest & Mint" theme optimized for readability and field use.

## 🛠️ Tech Stack
*   **Frontend**: Next.js 15+ (React 19)
*   **Backend**: Supabase (Auth, PostgreSQL, Storage)
*   **AI**: Google Gemini API (2.5 Flash)
*   **Real-time**: WebRTC MediaDevices & MediaRecorder API
*   **Styling**: Modern Vanilla CSS with CSS Variables

## 🚀 Getting Started

### Prerequisites
*   Node.js 20+
*   Supabase Account
*   Google AI (Gemini) API Key

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Yog-1to1-code/AgriBud.git
    cd AgriBud
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Setup Environment Variables**:
    Create a `.env.local` file with the following:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Database Setup**:
    Run the provided `database_schema.sql` in your Supabase SQL Editor.

5.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 📄 License
This project is licensed under the MIT License.

---
*Helping Indian farmers grow healthier crops and achieve prosperous farms through innovation.*
