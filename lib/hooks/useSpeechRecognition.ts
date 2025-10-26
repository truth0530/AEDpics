// Speech recognition hook for voice input
import { useEffect, useState, useRef, useCallback } from 'react';

interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
}

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

// Extend Window interface for SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useSpeechRecognition(options: SpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');

  // Initialize speech recognition
  useEffect(() => {
    const window = global.window as IWindow;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      const recognition = new SpeechRecognition();
      recognition.continuous = options.continuous ?? false;
      recognition.interimResults = options.interimResults ?? true;
      recognition.lang = options.language ?? 'ko-KR';
      recognition.maxAlternatives = options.maxAlternatives ?? 1;
      
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = (event: any) => {
        setError(event.error);
        setIsListening(false);
      };
      
      recognition.onresult = (event: any) => {
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          
          if (result.isFinal) {
            finalTranscriptRef.current += result[0].transcript + ' ';
            setTranscript(finalTranscriptRef.current);
          } else {
            interim += result[0].transcript;
          }
        }
        
        setInterimTranscript(interim);
      };
      
      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [options.continuous, options.interimResults, options.language, options.maxAlternatives]);

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      finalTranscriptRef.current = '';
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        if ((error as Error).message.includes('already started')) {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current.start();
          }, 100);
        }
      }
    }
  }, [isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    clearTranscript
  };
}

// Voice commands hook
export function useVoiceCommands(commands: Record<string, () => void>) {
  const { transcript, isListening, startListening, stopListening, isSupported } = 
    useSpeechRecognition({ continuous: true });
  
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Process voice commands
  useEffect(() => {
    if (!transcript) return;
    
    const lowercaseTranscript = transcript.toLowerCase().trim();
    
    // Check for commands
    for (const [command, action] of Object.entries(commands)) {
      if (lowercaseTranscript.includes(command.toLowerCase())) {
        setLastCommand(command);
        action();
        break;
      }
    }
  }, [transcript, commands]);

  // Toggle voice commands
  const toggleVoiceCommands = useCallback(() => {
    if (isActive) {
      stopListening();
      setIsActive(false);
    } else {
      startListening();
      setIsActive(true);
    }
  }, [isActive, startListening, stopListening]);

  return {
    isActive,
    isListening,
    lastCommand,
    isSupported,
    toggleVoiceCommands
  };
}

// Dictation hook for form fields
export function useDictation() {
  const { 
    transcript, 
    interimTranscript, 
    isListening, 
    startListening, 
    stopListening, 
    clearTranscript,
    isSupported 
  } = useSpeechRecognition({ 
    continuous: false, 
    interimResults: true 
  });
  
  const [targetField, setTargetField] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Start dictation for a specific field
  const startDictation = useCallback((field: HTMLInputElement | HTMLTextAreaElement) => {
    setTargetField(field);
    clearTranscript();
    startListening();
  }, [clearTranscript, startListening]);

  // Stop dictation and update field
  const stopDictation = useCallback(() => {
    stopListening();
    
    if (targetField && transcript) {
      const event = new Event('input', { bubbles: true });
      targetField.value = targetField.value + ' ' + transcript;
      targetField.dispatchEvent(event);
    }
    
    setTargetField(null);
  }, [stopListening, targetField, transcript]);

  // Cancel dictation without updating
  const cancelDictation = useCallback(() => {
    stopListening();
    clearTranscript();
    setTargetField(null);
  }, [stopListening, clearTranscript]);

  return {
    isListening,
    transcript: transcript + interimTranscript,
    isSupported,
    startDictation,
    stopDictation,
    cancelDictation
  };
}