"use client";

import { useState } from "react";
export default function About() {
    const [message, setMessage] = useState('');
    const email = "hrishikeshsathyian2002@gmail.com"
    const handlePing = async () => {
      try {
    
        const response = await fetch('/api/auth/getUserByEmail', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 
          },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        
        setMessage(data.user.uid);
      } catch (error) {
        setMessage(`Error occurred while pinging, ${(error as Error).message}`);
      }
    };
  
    return (
      <div>
        <h1>This is the Testing Page.</h1>
        <button onClick={handlePing}>Get User Working</button>
        {message && <p>{message}</p>}
        <button onClick={() => setMessage('')}>Reset</button>
      </div>
    );
  }