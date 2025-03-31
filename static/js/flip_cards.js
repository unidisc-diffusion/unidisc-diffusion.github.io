(function() {
    const flipCardsData = [
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.002.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.001.jpeg", 
        backCaption: ""
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.004.jpeg", 
        frontCaption: "",
        backUrl: "static/images/unidisc_main/unidisc_main.003.jpeg", 
        backCaption: "", 
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.006.jpeg", 
        frontCaption: "",
        backUrl: "static/images/unidisc_main/unidisc_main.005.jpeg", 
        backCaption: "", 
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.008.jpeg", 
        frontCaption: "",
        backUrl: "static/images/unidisc_main/unidisc_main.007.jpeg", 
        backCaption: "", 
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.010.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.009.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.012.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.011.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.014.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.013.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.016.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.015.jpeg", 
        backCaption: "",
      },
      {
        frontUrl: "static/images/unidisc_main/unidisc_main.018.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.017.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl:  "static/images/unidisc_main/unidisc_main.020.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.019.jpeg",
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.022.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.021.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.024.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.023.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.026.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.025.jpeg", 
        backCaption: ""
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.028.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.027.jpeg", 
        backCaption: "",
      },
      { 
        frontUrl: "static/images/unidisc_main/unidisc_main.030.jpeg", 
        frontCaption: "", 
        backUrl: "static/images/unidisc_main/unidisc_main.029.jpeg", 
        backCaption: "",
      }
      // ,
      // { 
      //   frontUrl: "static/images/flipping/joint/19_f.png", 
      //   frontCaption: "", 
      //   backUrl: "static/images/flipping/joint/19_b.png", 
      //   backCaption: "",
      // }            
    ];

    // Randomize the order of flipCardsData
    flipCardsData.sort(() => Math.random() - 0.5);
    const container = document.querySelector('#flipping-images-section .flip-card-container');
    
    flipCardsData.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'flip-card';
      cardDiv.innerHTML = `
        <div class="flip-card-inner">
          <div class="flip-card-front">
            
            <figure>
              <img src="${card.frontUrl}" alt="Front Image">
              ${card.frontCaption ? `<figcaption>${card.frontCaption}</figcaption>` : ''}
            </figure>
          </div>
          <div class="flip-card-back">
            <span class="input-label">Input</span>
            <figure>
              <div class="back-image-container">
                <img src="${card.backUrl}" alt="Back Image">
                <div class="back-image-overlay"></div>
              </div>
              ${card.backCaption ? `<figcaption>${card.backCaption}</figcaption>` : ''}
            </figure>
          </div>
        </div>
      `;
      container.appendChild(cardDiv);
    });
    
    function initFlipCards() {
      const flipCards = document.querySelectorAll('#flipping-images-section .flip-card');
      flipCards.forEach(card => {
        card.addEventListener('click', () => {
          card.classList.toggle('flipped');
        });
      });
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFlipCards);
    } else {
      initFlipCards();
    }
    
    // Automatic random flipping logic
    (function autoFlip() {
      const flipCards = Array.from(document.querySelectorAll('#flipping-images-section .flip-card'));
      function randomFlipCard() {
        if (flipCards.length === 0) return;
        const randomIndex = Math.floor(Math.random() * flipCards.length);
        const card = flipCards[randomIndex];
        card.classList.toggle('flipped');
        setTimeout(randomFlipCard, 3000);
      }
      setTimeout(randomFlipCard, 3000);
    })();
  })();