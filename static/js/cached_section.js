(() => {
    let API_URL = "https://anon.com/v1/chat/completions";
    const HARDCODED_CONFIG = {
        temperature: 0.9,
        top_p: 0.95,
        maskgit_r_temp: 4.5,
        cfg: 2.5,
        max_tokens: 32,
        resolution: 512,
        sampling_steps: 32,
        sampler: "maskgit_nucleus",
        use_reward_models: true
    };

    const GRID_SIZE = 8;
    window.autoResetOnMaskSelect = true;
    window.enable_cache = false;
    window.skipHashChecking = false;
    let isImageRemoved = false; // Add flag to track if image is removed
    let DISABLE_HASH_CHECKING = false; // Add this flag to globally disable hash checking

    function getMaskSize() {
      const maskSizeInput = document.getElementById('cached-mask-size');
      if (maskSizeInput) {
        const size = parseInt(maskSizeInput.value, 10);
        // Validate the size is between 2 and GRID_SIZE
        return Math.min(Math.max(size, 2), GRID_SIZE);
      }
      return 6; // Default value if input not found
    }
    
    // --- Utility functions ---
    async function processImage(imageBytes) {
        const img = await createImageBitmap(new Blob([imageBytes], { type: 'image/jpeg' }));
        const canvas = squareCrop(img);
        return canvas.convertToBlob({ quality: 0.95, type: 'image/jpeg' });
    }
    
    function squareCrop(img) {
        const size = Math.min(img.width, img.height);
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,
            (img.width - size) / 2, (img.height - size) / 2, size, size,
            0, 0, size, size
        );
        return canvas;
    }
    
    function encodeMask(maskArray) {
        const rows = maskArray.length;
        const cols = maskArray[0].length;
        const canvas = document.createElement('canvas');
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext('2d');
    
        const imageData = ctx.createImageData(cols, rows);
        for (let i = 0; i < maskArray.flat().length; i++) {
            const val = maskArray.flat()[i];
            const color = val ? 255 : 0;
            const pixelIndex = i * 4; // Each pixel uses 4 bytes in the array
            
            imageData.data[pixelIndex]     = color; // R
            imageData.data[pixelIndex + 1] = color; // G
            imageData.data[pixelIndex + 2] = color; // B
            imageData.data[pixelIndex + 3] = color; // A
        }
        ctx.putImageData(imageData, 0, 0);
    
        const dataURL = canvas.toDataURL("image/png");
        return {
            data: dataURL.split(',')[1],
            width: cols,
            height: rows
        };
    }

    function isChromeBrowser() {
      return /Chrome/.test(navigator.userAgent) && navigator.vendor === "Google Inc.";
    }
    

    async function callUnidiscAPI(imageBlob, maskArray, sentence, options = {}) {

        if (!isChromeBrowser()) {
          alert("Warning: The pre-cached demo only works in Chrome due to differences in hashing algorithms.");
        }
        // Use effective image removal flag based on options or the global isImageRemoved.
        const effectiveIsImageRemoved = (options.noImage === true) ? true : isImageRemoved;
        let customAPIUrl = API_URL;

        // Replace <mask> with <m> for API call
        const apiSentence = sentence.replace(/<mask>/g, "<m>");
        console.log("Called API with sentence: ", apiSentence);
        const messages = [{
                role: "user",
                content: [
                    { type: "text", text: apiSentence }
                ]
            },
            {
                role: "assistant",
                content: []
            }
        ];

        // Check if we need to include the image and mask
        const hasMaskedText = apiSentence.includes("<m>");
        const hasMaskedImage = maskArray && maskArray.some(row => row.some(cell => cell === true));

        let imageBase64;
        let maskData;

        // Only include image and mask if needed AND image is not removed.
        if ((hasMaskedText || hasMaskedImage) && !effectiveIsImageRemoved) {
            const resizedImage = await processImage(await imageBlob.arrayBuffer());
            imageBase64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(resizedImage);
            });
            messages[1].content.push({
                type: "image_url",
                image_url: { url: imageBase64 },
                is_mask: false
            });

            if (maskArray) {
                maskData = encodeMask(maskArray);
                messages[1].content.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${maskData.data}`,
                        mask_info: JSON.stringify({
                            width: maskData.width,
                            height: maskData.height
                        })
                    },
                    is_mask: true
                });
            }
        }

        if (messages.length > 0 &&
            messages[messages.length - 1].role === 'assistant' &&
            (!messages[messages.length - 1].content ||
             messages[messages.length - 1].content.length === 0)) {
            console.log("Removing empty assistant message");
            messages.pop(); // Remove the empty assistant message
        }

        // Create the payload without the hash first.
        const payload = {
            messages,
            model: "unidisc",
            ...HARDCODED_CONFIG
        };

        // Caching logic - hash the entire request payload.
        let hash = null;
        console.log("Payload: ", payload);
        console.log("DISABLE_HASH_CHECKING: ", DISABLE_HASH_CHECKING);
        console.log("options.skipHashChecking: ", options.skipHashChecking);
        
        // Skip hash generation and checking if DISABLE_HASH_CHECKING is true
        if (!DISABLE_HASH_CHECKING && !options.skipHashChecking) {
            try {
                const payloadString = JSON.stringify(payload);
                const encoder = new TextEncoder();
                const data = encoder.encode(payloadString);

                if (typeof crypto !== 'undefined' && crypto.subtle) {
                    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    console.log("Hash generated from full payload:", hash);
                } else {
                    throw new Error('Web Crypto API is not available. Please ensure you are serving your page over HTTPS or via localhost.');
                }
            } catch (error) {
                console.error('Error generating hash:', error);
            }
        }

        try {
            // Check cache using the hash only if hash checking is enabled
            if (hash && !DISABLE_HASH_CHECKING && !options.skipHashChecking) {
                try {
                    const response = await fetch(`/static/responses/${hash}.json`, {
                        mode: 'cors',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    if (response.ok) {
                        const jsonContent = await response.text();
                        console.log("Cache hit!");
                        const cachedData = JSON.parse(jsonContent);
                        console.log("Cached data: ", cachedData);
                        return {
                            choices: [{
                                index: 0,
                                message: cachedData,
                                finish_reason: "stop"
                            }]
                        };
                    } else {
                        console.log("Cache miss:", response);
                    }
                } catch (cacheError) {
                    console.log("Cache access failed:", cacheError);
                    console.log("Proceeding with direct API call");
                }
            }
        } catch (error) {
            console.log("Cache miss:", error)
        }

        console.log("Hash: ", hash);

        // Only add hash to payload if hash checking is enabled
        if (hash && !DISABLE_HASH_CHECKING) {
            payload.request_hash = hash;
        }

        console.log("Payload: ", payload);

        try {
            const response = await fetch(customAPIUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            console.log("Response: ", data);
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    window.callUnidiscAPI = callUnidiscAPI;
    
    const section = document.getElementById('cached-section');
    const grid = section.querySelector('#cached-grid');
    const currentSentence = section.querySelector('#cached-current-sentence');
    const responseText = section.querySelector('#cached-response-text');
    const inputImage = section.querySelector('#cached-input-image');
    const outputImage = section.querySelector('#cached-output-image');

    const cells = [];
    let currentRow = 0;
    let currentCol = 0;
    let maskLocked = false; // Add this flag to track if mask is locked in place
    let activeMask = null; // Track the currently active mask coordinates

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'cached-grid-cell';
      cell.dataset.row = Math.floor(i / GRID_SIZE);
      cell.dataset.col = i % GRID_SIZE;
      grid.appendChild(cell);
      cells.push(cell);
    }
    
    function createMaskArray(topLeftRow, topLeftCol) {
      const maskSize = getMaskSize();
      const maskArray = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
      for (let r = topLeftRow; r < topLeftRow + maskSize && r < GRID_SIZE; r++) {
        for (let c = topLeftCol; c < topLeftCol + maskSize && c < GRID_SIZE; c++) {
          maskArray[r][c] = true;
        }
      }
      return maskArray;
    }
    
    function highlightCells(row, col) {
      // If mask is locked, don't update highlights on mousemove
      if (maskLocked) return;
      
      cells.forEach(cell => cell.classList.remove('cached-highlighted'));
      const maskSize = getMaskSize();
      const offset = Math.floor(maskSize / 2);
      const topLeftRow = Math.min(Math.max(row - offset, 0), GRID_SIZE - maskSize);
      const topLeftCol = Math.min(Math.max(col - offset, 0), GRID_SIZE - maskSize);
      currentRow = row;
      currentCol = col;

      for (let r = topLeftRow; r < topLeftRow + maskSize && r < GRID_SIZE; r++) {
        for (let c = topLeftCol; c < topLeftCol + maskSize && c < GRID_SIZE; c++) {
          const cell = cells[r * GRID_SIZE + c];
          if (cell) {
            cell.classList.add('cached-highlighted');
          }
        }
      }
    }
    
    const selectedWords = new Array(6).fill(null);
    const defaultSelections = [
        "a happy",
        "puppy",
        "wearing a",
        "top hat",
        ", cartoon style",
    ];

    // Initialize with default selections
    defaultSelections.forEach((word, index) => {
        selectedWords[index] = word;
        const wordElement = section.querySelector(`.cached-word-option[data-row="${index}"][data-word="${word}"]`);
        if (wordElement) {
            wordElement.classList.add('cached-selected');
        }
    });

    currentSentence.textContent = processSentence(selectedWords);

    function constructSentence(words) {
        return words.join(" ")
               .replace(" , ", ", ")
               .replace(/<mask>\s<mask>/g, "<mask><mask><mask>");
    }

    function processSentence(words_to_process) {
      const words = words_to_process.filter(word => word !== null);
      const finalWords = words.length > 0 ? words : defaultSelections;
      return constructSentence(finalWords);
    }
    
    section.querySelectorAll('.cached-word-option').forEach(word => {
        word.addEventListener('click', async () => {
            const row = parseInt(word.dataset.row);
            const wordText = word.dataset.word;
    
            // If auto-reset mode is enabled AND the image is not already removed,
            // reset the image before changing text
            if (window.autoResetOnMaskSelect && !isImageRemoved) {
                inputImage.src = originalImageSrc;
                inputImage.style.filter = "none"; // Clear any filters
                isImageRemoved = false; // Reset the image removed flag
                
                // Hide the grey overlay
                const greyOverlay = section.querySelector('#cached-grey-overlay');
                greyOverlay.style.display = "none";
                
                // Reset output display
                responseText.textContent = 'Select words and interact with the input image to see results here.';
                outputImage.src = originalImageSrc;
            }
    
            section.querySelectorAll(`.cached-word-option[data-row="${row}"]`)
                   .forEach(w => w.classList.remove('cached-selected'));
    
            word.classList.add('cached-selected');
            selectedWords[row] = wordText;
    
            currentSentence.textContent = processSentence(selectedWords);
            
            try {
                await updateOutput();
            } catch (error) {
                console.error('Error updating output after text change:', error);
            }
        });
    });
    
    grid.addEventListener('mousemove', (e) => {
        const rect = grid.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const col = Math.floor((x / rect.width) * GRID_SIZE);
        const row = Math.floor((y / rect.height) * GRID_SIZE);
        highlightCells(row, col);
    });
    
    async function updateOutput() {
        try {
            const currentSentence = section.querySelector('#cached-current-sentence');
            const responseText = section.querySelector('#cached-response-text');
            const greyOverlay = section.querySelector('#cached-grey-overlay');
            const outputOverlay = section.querySelector('#cached-output-overlay');

            let maskArray = null;
            
            // Only create a mask if we have an active mask
            if (activeMask) {
                const [topLeftRow, topLeftCol] = activeMask;
                maskArray = createMaskArray(topLeftRow, topLeftCol);
            }
    
            const sentence = currentSentence.textContent;
            const imageBlob = await fetch(inputImage.src).then(res => res.blob());
            
            
            responseText.textContent = 'Processing your request...'; // Show loading state
            outputOverlay.style.display = "block"; // Show grey overlay while loading
            outputOverlay.innerHTML = ""; // Reset any previous custom text in the overlay
            
            console.log("sentence: ", sentence);
            const response = await callUnidiscAPI(imageBlob, maskArray, sentence);
            
            const message = response.choices?.[0]?.message;
            if (!message) {
                throw new Error("No message found in the API response");
            }

            // Extract text content if available
            let textContent = '';
            if (Array.isArray(message.content)) {
                const textPart = message.content.find(part => part.type === "text");
                if (textPart && textPart.text) {
                    textContent = textPart.text;
                }
            } else if (typeof message.content === 'string') {
                textContent = message.content;
            }

            if (textContent) {
                textContent = textContent.replace(/\s+/g, ' ').replace(/ ([b-zB-Z]) /g, " ");
                responseText.textContent = textContent;
            } else {
                responseText.textContent = 'Image updated successfully!';
            }

            // Check if there's an image in the response
            let imageUrl = null;
            if (Array.isArray(message.content)) {
                const imagePart = message.content.find(part => part.type === "image_url");
                if (imagePart && imagePart.image_url && imagePart.image_url.url) {
                    imageUrl = imagePart.image_url.url;
                }
            } else if (message.image_url && message.image_url.url) {
                imageUrl = message.image_url.url;
            }

            // Update the output image if we have an image response
            if (imageUrl) {
                const newImageUrl = imageUrl.startsWith("data:image/jpeg;base64,")
                    ? imageUrl
                    : `data:image/jpeg;base64,${imageUrl}`;
                outputImage.src = newImageUrl;
                // Hide the output overlay when image is ready
                outputOverlay.style.display = "none";
            } else {
                // No image in response, but API was successful
                // Show "Image Fixed" text on the overlay
                outputOverlay.style.display = "block";
                outputOverlay.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: white; font-size: 24px; font-weight: bold; text-shadow: 1px 1px 3px black;">Image Fixed</div>';
            }
        } catch (error) {
            console.error('Output update failed:', error);
            responseText.textContent = 'Error: ' + error.message;
            // Keep the grey overlay visible on error
        }
    }
    
    grid.addEventListener('click', async () => {
        const maskSize = getMaskSize();
        const offset = Math.floor(maskSize / 2);
        // Compute the top-left coordinate of the mask ensuring it stays within grid bounds.
        const safeTopLeftRow = Math.min(Math.max(currentRow - offset, 0), GRID_SIZE - maskSize);
        const safeTopLeftCol = Math.min(Math.max(currentCol - offset, 0), GRID_SIZE - maskSize);
        
        // If auto-reset mode is enabled, reset the image before selecting the mask
        if (window.autoResetOnMaskSelect) {
            inputImage.src = originalImageSrc;
            inputImage.style.filter = "none"; // Clear any filters
            isImageRemoved = false; // Reset the image removed flag
            
            // Hide the grey overlay
            const greyOverlay = section.querySelector('#cached-grey-overlay');
            greyOverlay.style.display = "none";
        }
        
        if (maskLocked && 
            activeMask && 
            activeMask[0] === safeTopLeftRow && 
            activeMask[1] === safeTopLeftCol) {
            // If clicking on the same mask area, unlock it
            console.log("Clearing mask after clicking on the same mask area");
            maskLocked = false;
            activeMask = null;
            // Clear highlights
            cells.forEach(cell => cell.classList.remove('cached-highlighted'));
            // Don't call updateOutput when just removing the mask
            return;
        } else {
            // Lock the mask at current position
            maskLocked = true;
            activeMask = [safeTopLeftRow, safeTopLeftCol];
            
            // Ensure the mask area is properly highlighted
            cells.forEach(cell => cell.classList.remove('cached-highlighted'));
            for (let r = safeTopLeftRow; r < safeTopLeftRow + maskSize && r < GRID_SIZE; r++) {
                for (let c = safeTopLeftCol; c < safeTopLeftCol + maskSize && c < GRID_SIZE; c++) {
                    const cell = cells[r * GRID_SIZE + c];
                    if (cell) {
                        cell.classList.add('cached-highlighted');
                    }
                }
            }
        }
    
        try {
            await updateOutput();
        } catch (error) {
            console.error('Error updating output:', error);
        }
    });
    
    grid.addEventListener('mouseleave', () => {
        // Only clear highlights if mask is not locked
        if (!maskLocked) {
            cells.forEach(cell => cell.classList.remove('cached-highlighted'));
        }
    });
    
    // Initialize highlighting with default values.
    highlightCells(1, 1);

    // Add event listeners for the reset buttons
    const resetImageButton = section.querySelector('#cached-reset-image');
    const clearMaskButton = section.querySelector('#cached-clear-mask');
    const removeImageButton = section.querySelector('#cached-remove-image');
    const greyOverlay = section.querySelector('#cached-grey-overlay');
    const originalImageSrc = "static/images/giraffe.png"; // Store the original image source
    
    // Reset image button functionality
    resetImageButton.addEventListener('click', () => {
      inputImage.src = originalImageSrc;
      inputImage.style.filter = "none"; // Clear any filters
      isImageRemoved = false; // Reset the image removed flag
      
      // Hide the grey overlay
      greyOverlay.style.display = "none";
      
      // Also clear the mask when resetting the image
      console.log("Clearing mask after resetting the image");
      maskLocked = false;
      activeMask = null;
      cells.forEach(cell => cell.classList.remove('cached-highlighted'));
      
      // Reset the output image and response text
      outputImage.src = originalImageSrc;
      responseText.textContent = 'Select words and interact with the input image to see results here.';
      // Show the output overlay when resetting
      document.querySelector('#cached-output-overlay').style.display = "block";
    });
    
    // Clear mask button functionality
    clearMaskButton.addEventListener('click', () => {
      console.log("Clearing mask without affecting the image");
      maskLocked = false;
      activeMask = null;
      cells.forEach(cell => cell.classList.remove('cached-highlighted'));
      
      // Update the output to reflect that the mask has been cleared
      responseText.textContent = 'Mask cleared. Select an area of the image to mask or choose different words.';
    });
    
    // Remove image button functionality
    removeImageButton.addEventListener('click', async () => {
      // Show the solid grey overlay
      greyOverlay.style.display = "block";
      isImageRemoved = true; // Set flag to indicate image is removed
      
      // Clear any active mask
      console.log("Clearing mask after removing image");
      maskLocked = false;
      activeMask = null;
      cells.forEach(cell => cell.classList.remove('cached-highlighted'));
      
      // Call the API after fully masking the image
      try {
        await updateOutput();
      } catch (error) {
        console.error('Error updating output after fully masking image:', error);
      }
    });

    // Add event listener for mask size changes to update the highlight
    const maskSizeInput = document.getElementById('cached-mask-size');
    if (maskSizeInput) {
      maskSizeInput.addEventListener('change', () => {
        // If we have an active mask, clear it as the size has changed
        if (maskLocked && activeMask) {
          maskLocked = false;
          activeMask = null;
          cells.forEach(cell => cell.classList.remove('cached-highlighted'));
        }
        // Update the highlight with the current mouse position
        if (currentRow !== undefined && currentCol !== undefined) {
          highlightCells(currentRow, currentCol);
        }
      });
    }

    if (window.enable_cache) {
      setTimeout(() => {
        async function precache() {
          async function getImageBlob() {
            const img = document.querySelector('.cached-image');
            if (!img) throw new Error("No image element found for precaching.");
            return await fetch(img.src).then(res => res.blob());
          }

          const rowOptions = {};
          const wordElements = document.querySelectorAll('#cached-section .cached-word-option');
          wordElements.forEach(elem => {
            const row = elem.getAttribute('data-row');
            const word = elem.getAttribute('data-word');
            if (!rowOptions[row]) rowOptions[row] = [];
            rowOptions[row].push(word);
          });

          let numWords = Object.keys(rowOptions).length
          console.log(`Found ${numWords} words to process.`);
          const textCombinations = [];

          // Generate all possible combinations of words
          if (Object.keys(rowOptions).length > 0) {
            function buildSentences(tokens, currentRow) {
              if (currentRow === numWords) {
                const sentence = processSentence(tokens);
                console.log("sentence: ", sentence);
                textCombinations.push(sentence);
                return;
              }
              
              if (rowOptions[currentRow]) {
                for (const word of rowOptions[currentRow]) {
                  // Accumulate tokens for the current sentence.
                  buildSentences([...tokens, word], currentRow + 1);
                }
              } else {
                // If no tokens on this row, continue to the next.
                buildSentences(tokens, currentRow + 1);
              }
            }
            
            buildSentences([], 0);
          }
          
          const maskPositions = [];
          for (let r = 0; r <= GRID_SIZE - getMaskSize(); r++) {
            for (let c = 0; c <= GRID_SIZE - getMaskSize(); c++) {
              maskPositions.push([r, c]);
            }
          }

          let imageBlob = null;
          try {
            imageBlob = await getImageBlob();
          } catch (e) {
            console.error("Failed to fetch image for precaching:", e);
          }

          const apiCallConfigs = [];
          for (const text of textCombinations) {
            // (1) With image and every possible mask.
            for (const [topRow, topCol] of maskPositions) {
              const maskArray = createMaskArray(topRow, topCol);
              apiCallConfigs.push({ 
                text, 
                maskArray, 
                type: "with mask",
                position: [topRow, topCol]
              });
            }
            // (2) With image and no mask.
            apiCallConfigs.push({ 
              text, 
              maskArray: null, 
              type: "no mask" 
            });
            // (3) No image (simulate removal).
            apiCallConfigs.push({ 
              text, 
              maskArray: null, 
              type: "no image",
              noImage: true 
            });
          }

          console.log(`Precaching prepared: ${apiCallConfigs.length} API calls (${textCombinations.length} text combinations and ${maskPositions.length} mask positions)`);

          const BATCH_SIZE = 128;      // Process this many requests at once
          const DELAY_MS = 10000;      // Wait this many ms between batches
          let completedCalls = 0;

          for (let i = 0; i < apiCallConfigs.length; i += BATCH_SIZE) {
            const batch = apiCallConfigs.slice(i, i + BATCH_SIZE);
            
            await Promise.all(
              batch.map(config => {
                return callUnidiscAPI(
                  imageBlob, 
                  config.maskArray, 
                  config.text, 
                  { 
                    noImage: config.noImage
                  }
                )
                .then(() => {
                  completedCalls++;
                  if (completedCalls % 10 === 0) {
                    console.log(`Precaching progress: ${completedCalls}/${apiCallConfigs.length} complete`);
                  }
                })
                .catch(err => console.error(
                  "Precaching call failed:", 
                  config.type, 
                  config.text, 
                  config.position || "", 
                  err
                ));
              })
            );
            
            // Add delay between batches
            if (i + BATCH_SIZE < apiCallConfigs.length) {
              await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
          }

          console.log(`Precaching complete. Total API calls made: ${apiCallConfigs.length}`);
        }
        precache();
      }, 1000);
    }
  })();