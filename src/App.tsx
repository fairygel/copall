import { ArrowUp, MessageCirclePlus, Settings, X } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import "./App.css";

const aiMessage1 = 'Hello! How can I help you today?';
const aiMessage2 = 'Based on general knowledge, here are the countries with the highest populations in the world:' +
  '\n1. **India** — approximately 1.43 billion (surpassed China in 2023)' +
  '\n2. **China** — approximately 1.41 billion' +
  '\n3. **United States** — approximately 340 million' +
  '\n4. **Indonesia** — approximately 280 million' +
  '\n5. **Pakistan** — approximately 240 million' +
  '\n6. **Nigeria** — approximately 220 million' +
  '\n7. **Brazil** — approximately 216 million' +
  '\n8. **Bangladesh** — approximately 173 million' +
  '\n9. **Russia** — approximately 144 million' +
  '\n10. **Mexico** — approximately 130 million\n' +
  '\nIndia overtook China as the world\'s most populous country around mid-2023, according to UN estimates. These figures are approximate and fluctuate with births, deaths, and migration.';

function App() {
  return (
    <main>
      <div data-tauri-drag-region className="header">
        <div data-tauri-drag-region className="icons">
          <div className="clickable"><Settings size={20}/></div>
          <div className="clickable"><MessageCirclePlus size={20}/></div>
        </div>
        <div className="chatName">Chat Name a little longer</div>
        <div className="windowIcons">
          <div className="clickable"><X size={14} /></div>
        </div>
      </div>
      
      <div className="chatContainer">
        <div className="message userMessage">hello!</div>
        <div className="message aiMessage">
          <ReactMarkdown>{aiMessage1}</ReactMarkdown>
        </div>
        <div className="message userMessage">Say what countries has the highest population in worldSay what countries has the highest population in world</div>

        <div className="message aiMessage">
          <ReactMarkdown>{aiMessage2}</ReactMarkdown>
        </div>
      </div>

      <div className="messageContainer">
        <textarea className="inputArea" placeholder="Your move, Ask!"></textarea>
        <div className="tooltip">
          <button className="sendMessage">
            <ArrowUp size={24} color="white" />
          </button>
        </div>
      </div>
    </main>
  )
}

export default App;
