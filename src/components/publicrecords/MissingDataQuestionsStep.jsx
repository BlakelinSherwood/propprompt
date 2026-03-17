import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function MissingDataQuestionsStep({ questions, onComplete, onExit }) {
  const [answers, setAnswers] = useState({});
  const [canProceed, setCanProceed] = useState(false);

  const handleAnswer = (questionId, value) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    
    // Check if all blocking questions answered
    const allBlockingAnswered = questions
      .filter(q => q.isBlocking)
      .every(q => updated[q.id] !== undefined && updated[q.id] !== null && updated[q.id] !== '');
    
    setCanProceed(allBlockingAnswered);
  };

  const handleProceed = () => {
    // Check for blocking questions with "unsure" or no answer
    const blockingWithoutAnswer = questions.find(q => 
      q.isBlocking && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '')
    );
    
    if (blockingWithoutAnswer && blockingWithoutAnswer.id === 'mortgage_status' && answers[blockingWithoutAnswer.id] === 'unsure') {
      alert('Without this information, we cannot generate a reliable portfolio analysis.\n\nWe recommend:\n1. Ask your client directly\n2. Check with a title company\n3. Come back once you have more information');
      return;
    }

    onComplete(answers);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1A3226] mb-2">We Need a Bit More Information</h2>
        <p className="text-[#1A3226]/70">
          PropPrompt found some gaps in the public records for this property. Your answers will help us generate a more accurate analysis — or let us know if this property isn't a good candidate right now.
        </p>
      </div>

      <div className="space-y-6">
        {questions.map(question => (
          <div
            key={question.id}
            className="p-6 border border-[#1A3226]/10 rounded-lg bg-white space-y-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#B8982F] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-[#1A3226]">{question.question}</h3>
                {question.isBlocking && (
                  <span className="inline-block mt-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                    Required
                  </span>
                )}
              </div>
            </div>

            {/* Yes/No/Not Sure buttons */}
            {question.type === 'yes_no_unsure' && (
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAnswer(question.id, 'yes')}
                  variant={answers[question.id] === 'yes' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  Yes, they have a mortgage
                </Button>
                <Button
                  onClick={() => handleAnswer(question.id, 'no')}
                  variant={answers[question.id] === 'no' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  No, free and clear
                </Button>
                <Button
                  onClick={() => handleAnswer(question.id, 'unsure')}
                  variant={answers[question.id] === 'unsure' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  I'm not sure
                </Button>
              </div>
            )}

            {/* Yes/No buttons */}
            {question.type === 'yes_no' && (
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAnswer(question.id, 'yes')}
                  variant={answers[question.id] === 'yes' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  Yes
                </Button>
                <Button
                  onClick={() => handleAnswer(question.id, 'no')}
                  variant={answers[question.id] === 'no' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  No
                </Button>
              </div>
            )}

            {/* Dollar amount input */}
            {question.type === 'dollar' && (
              <input
                type="number"
                placeholder="$0"
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
              />
            )}

            {/* Date input */}
            {question.type === 'date' && (
              <input
                type="date"
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
              />
            )}

            {/* Free text */}
            {question.type === 'text' && (
              <textarea
                placeholder="Enter your answer..."
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                rows={3}
              />
            )}

            <p className="text-sm text-[#1A3226]/60 pt-2 border-t border-[#1A3226]/10">
              <span className="font-semibold">Why we ask:</span> {question.explanation}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button
          onClick={onExit}
          variant="outline"
          className="flex-1"
        >
          Save for Later
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!canProceed}
          className="flex-1 bg-[#1A3226]"
        >
          Continue to Payoff Selection
        </Button>
      </div>
    </div>
  );
}