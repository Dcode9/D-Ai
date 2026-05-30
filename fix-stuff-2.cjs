const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

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

fs.writeFileSync('index.html', indexHtml);
