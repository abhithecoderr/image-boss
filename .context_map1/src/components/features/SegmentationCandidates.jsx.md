**Purpose**

Result picker ui for object segmentation service that returns 3 final results

It renders a horizontal thumbnail strip list from which user picks one that is rendered to the final resultCanvas


**Code Structure**

*CandidateCard sub component*

Represents the individual thumbnail within the thumbnail list

```js
const CandidateCard = ({ candidate, idx, isSelected, onSelect }) => {
  const thumbRef = useRef(null);

  useEffect(() => {
    if (thumbRef.current) {
      const thumb = candidate.getThumbnail();
      thumbRef.current.innerHTML = '';
      thumbRef.current.appendChild(thumb);
    }
  }, [candidate]);

  return (
    <div
      className={`candidate-card ${isSelected ? 'active' : ''}`}
      onClick={() => onSelect(idx)}
      style={{
        border: isSelected ? '2px solid var(--highlight)' : '2px solid transparent'
      }}
    >
      <div ref={thumbRef} className="layer-thumb-canvas" />
      <div className="candidate-label">
        Option {idx + 1}
      </div>
    </div>
  );
};
```

----------------------------------------------


*SegmentationCandidates parent component*

Main parent component that extracts context, defines methods and returns the main thumbnail options strip

```js
const SegmentationCandidates = () => {
  const {
    segmentationResult,
    originalCanvas,
    setResultCanvas,
    updateProgress,
    setIsProcessing,
    showToast
  } = useApp();

  const [selectedIndex, setSelectedIndex] = useState(0);
  ```

*handleSelect function*

 Handles the user clicking a thumbnail and its rendering on the main resultCanvas on right

 ```js
 const handleSelect = async (idx) => {
    if (!segmentationResult?.options) return;

    setSelectedIndex(idx);
    const candidate = segmentationResult.options[idx];
    const mode = segmentationResult.mode;

    setIsProcessing(true);
    updateProgress(0.9, 'Generating high-res preview...');

    try {
      const renderedCanvas = await candidate.render(originalCanvas, mode);
      setResultCanvas(renderedCanvas);
    } catch (err) {
      console.error('[SAM] Failed to render candidate:', err);
      showToast('Render failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };
  ```

  *useEffect to render first returned thumbnail by default*

  ```js
  // Render first candidate on initial load
  useEffect(() => {
    if (segmentationResult?.options?.length > 0) {
      handleSelect(0);
    }
  }, [segmentationResult]);

  // Early return comes AFTER all top-level hooks
  if (!segmentationResult || !segmentationResult.options) {
    return null;
  }

  const candidates = segmentationResult.options;
  ```

  *Thumnail list returned by parent component*

  ```js
  return (
    <div className="layer-picker">
      <div className="picker-label">Select Subject Candidate</div>
      <div className="layers-container">
        {candidates.map((candidate, idx) => (
          <CandidateCard
            key={idx}
            candidate={candidate}
            idx={idx}
            isSelected={idx === selectedIndex}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default SegmentationCandidates;
```




