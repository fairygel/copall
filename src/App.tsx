import { ArrowUp } from "lucide-react";
import "./App.css";

function App() {
  return (
    <main>
      <div style={{flex: 1, flexDirection: "column"}}>chat section</div>
      
      <div className="messageContainer">
        <textarea className="inputArea" placeholder="Your move, Ask!"></textarea>
        <div className="tooltip">
          <button className="sendMessage">
            <ArrowUp size={24} color="white"/>
          </button>
        </div>
      </div>
    </main>
  )
}

export default App;
