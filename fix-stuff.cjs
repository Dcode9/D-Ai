const fs = require('fs');

// 1. Add colors to tailwind.config.js
let twConfig = fs.readFileSync('tailwind.config.js', 'utf8');
twConfig = twConfig.replace(
  "extend: {",
  `extend: {
      colors: {
        'dai-brand': 'var(--dai-brand)',
        'dai-brand-dim': 'var(--dai-brand-dim)',
        'dai-bg': 'var(--dai-bg)',
        'dai-surface': 'var(--dai-surface)',
        'dai-border': 'var(--dai-border)',
        'dai-text': 'var(--dai-text)',
        'dai-muted': 'var(--dai-muted)',
        'dai-soft': 'var(--dai-soft)',
        'dai-accent': 'var(--dai-accent)',
        'parchment-surface': 'var(--dai-surface)',
        'parchment-ink': 'var(--dai-text)',
      },`
);
fs.writeFileSync('tailwind.config.js', twConfig);

// 2. Add css variables to index.html root
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(
  ":root {",
  `:root {
        --dai-brand: #b79a8c;
        --dai-brand-dim: rgba(183, 154, 140, 0.2);
        --dai-bg: #fbfaf8;
        --dai-surface: #f5f4f0;
        --dai-border: rgba(127, 107, 98, 0.2);
        --dai-text: #7f6b62;
        --dai-muted: rgba(127, 107, 98, 0.6);
        --dai-soft: #a18a7f;
        --dai-accent: #b48c51;`
);

// 3. Fix image gen error handling to retry and show themed message
// Replace the catch block in the image fetch
indexHtml = indexHtml.replace(
  `            } catch (e) {
                console.error("Image Gen Failed:", e);
                // Stop animation visuals
                fluidCont.classList.remove('active');
                progSvg.classList.remove('active');
                genStatus.classList.remove('active');
                imgEl.classList.add('error');

                // Show Error UI
                const friendlyMsg = "It's not you, it's me. I encountered a glitch generating that image.";
                window.imgError(imgEl, e.message.includes("High Traffic") ? e.message : friendlyMsg);
            }`,
  `            } catch (e) {
                console.error("Image Gen Failed:", e);
                // Simple retry mechanism (up to 2 retries)
                window.imgRetries = (window.imgRetries || 0);
                if (window.imgRetries < 2 && !e.message.includes("unsafe")) {
                     window.imgRetries++;
                     console.log("Retrying image gen, attempt " + window.imgRetries);
                     setTimeout(() => window.fetchServerImage(imgEl, encPrompt, width, height, seed, containerId, encSourceImage), 1500);
                     return;
                }
                window.imgRetries = 0; // reset

                // Stop animation visuals
                fluidCont.classList.remove('active');
                progSvg.classList.remove('active');
                genStatus.classList.remove('active');
                imgEl.classList.add('error');

                // Show Error UI themed for parchment
                const friendlyMsg = "The conjuring failed. The mystical forces are unstable. Please try again.";
                window.imgError(imgEl, e.message.includes("High Traffic") ? "The aether is crowded (High Traffic). Wait a moment." : friendlyMsg);
            }`
);

// Do the same for video and music
indexHtml = indexHtml.replace(
  `            } catch (e) {
                console.error("Video Gen Failed:", e);
                // Stop animation visuals
                fluidCont.classList.remove('active');
                progSvg.classList.remove('active');
                genStatus.classList.remove('active');
                videoEl.classList.add('error');

                const friendlyMsg = "Video generation glitch. Please try again.";
                window.videoError(videoEl, e.message.includes("High Traffic") ? e.message : friendlyMsg);
            }`,
  `            } catch (e) {
                console.error("Video Gen Failed:", e);
                window.vidRetries = (window.vidRetries || 0);
                if (window.vidRetries < 2) {
                     window.vidRetries++;
                     setTimeout(() => window.fetchServerVideo(videoEl, encPrompt, width, height, duration, containerId, aspectRatio, encSourceImage), 1500);
                     return;
                }
                window.vidRetries = 0;

                fluidCont.classList.remove('active');
                progSvg.classList.remove('active');
                genStatus.classList.remove('active');
                videoEl.classList.add('error');

                const friendlyMsg = "The temporal viewing orb shattered. The mystical forces are unstable. Please try again.";
                window.videoError(videoEl, e.message.includes("High Traffic") ? "The aether is crowded (High Traffic)." : friendlyMsg);
            }`
);

// Fix chat retry
indexHtml = indexHtml.replace(
  `                        } catch (e) {
                            if (e.name === 'AbortError') return;
                            console.error("Chat Error:", e);
                            if (!window.send.isRetrying) {
                                window.send.isRetrying = true;
                                window.statusFlow("Connection interrupted. Re-establishing link...");
                                setTimeout(() => {`,
  `                        } catch (e) {
                            if (e.name === 'AbortError') return;
                            console.error("Chat Error:", e);

                            window.chatRetries = (window.chatRetries || 0);
                            if (window.chatRetries < 2) {
                                window.chatRetries++;
                                window.statusFlow("The mystical link faded. Re-establishing connection...");
                                setTimeout(() => {`
);

// Adjust chat retry state reset
indexHtml = indexHtml.replace(
  `                                    window.send.isRetrying = false;`,
  `                                    // wait next attempt`
);
indexHtml = indexHtml.replace(
  `                                        isStreamingStartedRetry = true;
                                        window.statusFlow(); // hide status on stream start
                                    }`,
  `                                        isStreamingStartedRetry = true;
                                        window.statusFlow(); // hide status on stream start
                                        window.chatRetries = 0; // reset
                                    }`
);
indexHtml = indexHtml.replace(
  `                                } catch (retryErr) {
                                    console.error("Retry failed:", retryErr);
                                    window.statusFlow();
                                    result.innerHTML += '<div class="dai-widget"><div class="dai-widget-head"><span class="dai-widget-kicker">Error</span></div><div class="dai-widget-body"><div class="dai-widget-note">Failed to communicate with AI after retry. Please try again.</div></div></div>';
                                    window.send.isRetrying = false;
                                }`,
  `                                } catch (retryErr) {
                                    console.error("Retry failed:", retryErr);
                                    window.statusFlow();
                                    result.innerHTML += '<div class="dai-widget"><div class="dai-widget-head" style="border-bottom-color: rgba(239, 68, 68, 0.4);"><span class="dai-widget-kicker" style="color: #ef4444;">Error</span></div><div class="dai-widget-body"><div class="dai-widget-note" style="color: #ef4444;">The arcane channels are completely blocked. The connection could not be restored after multiple attempts.</div></div></div>';
                                }`
);


// Rewrite the image and video error messages in the DOM itself (window.imgError, window.videoError) to match the parchment theme (like widgets)
indexHtml = indexHtml.replace(
  `        window.imgError = (imgEl, msg) => {
            const container = imgEl.closest('.dai-img-container');
            container.innerHTML = '<div style="padding:20px; color:#ef4444; text-align:center; display:flex; flex-direction:column; justify-content:center; height:100%;"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px; margin-bottom:10px;"></i>' + msg + '</div>';
        };`,
  `        window.imgError = (imgEl, msg) => {
            const container = imgEl.closest('.dai-img-container');
            container.innerHTML = '<div class="dai-widget" style="margin:0; height:100%; display:flex; flex-direction:column; justify-content:center; background:transparent; border-color:transparent;"><div class="dai-widget-head" style="border-bottom-color: rgba(239, 68, 68, 0.4);"><span class="dai-widget-kicker" style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Manifestation Error</span></div><div class="dai-widget-body"><div class="dai-widget-note" style="color: #ef4444;">' + msg + '</div></div></div>';
        };`
);
indexHtml = indexHtml.replace(
  `        window.videoError = (videoEl, msg) => {
            const container = videoEl.closest('.dai-video-container');
            container.innerHTML = '<div style="padding:20px; color:#ef4444; text-align:center; display:flex; flex-direction:column; justify-content:center; height:100%;"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px; margin-bottom:10px;"></i>' + msg + '</div>';
        };`,
  `        window.videoError = (videoEl, msg) => {
            const container = videoEl.closest('.dai-video-container');
            container.innerHTML = '<div class="dai-widget" style="margin:0; height:100%; display:flex; flex-direction:column; justify-content:center; background:transparent; border-color:transparent;"><div class="dai-widget-head" style="border-bottom-color: rgba(239, 68, 68, 0.4);"><span class="dai-widget-kicker" style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Vision Error</span></div><div class="dai-widget-body"><div class="dai-widget-note" style="color: #ef4444;">' + msg + '</div></div></div>';
        };`
);


fs.writeFileSync('index.html', indexHtml);
