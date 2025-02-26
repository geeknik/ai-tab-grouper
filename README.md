# AI Tab Grouper

AI Tab Grouper is a Brave extension that automatically organizes your tabs into groups using AI-powered text analysis algorithms.

![CleanShot 2024-09-18 at 11 34 26@2x](https://github.com/user-attachments/assets/462b125e-55a8-477b-b0b1-7064f369d7bb)

## Features

- Automatically groups related tabs using advanced text analysis
- Supports multiple grouping algorithms:
  - TF-IDF (Term Frequency-Inverse Document Frequency)
  - BM25 (Best Matching 25)
  - Keyphrase Extraction
  - LSA (Latent Semantic Analysis)
- Customizable settings for grouping behavior
- Ignores pinned tabs, ensuring they remain untouched
- Periodic automatic grouping with adjustable intervals
- Manual grouping option
- Persists grouping intelligence across browser sessions
- Respects user privacy by performing all processing locally

## Installation

1. Clone this repository or download the source code
2. Open Brave and navigate to `brave://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files

## Usage

Once installed, the extension will automatically start grouping your non-pinned tabs based on your settings. You can access the extension's popup by clicking on its icon in the Chrome toolbar. From there, you can:

- Manually trigger tab grouping
- View statistics about your current tabs and groups
- Access the settings page

### Pinned Tabs

Pinned tabs are always ignored by the extension. They will not be unpinned or included in any grouping operations.

## Settings

In the options page, you can customize:

- Grouping Algorithm: Choose between TF-IDF, BM25, Keyphrase Extraction, or LSA
- Similarity Threshold: Adjust how similar tabs need to be to be grouped together
- Automatic Grouping Interval: Set how often the extension should attempt to group tabs
- Maximum Group Name Length: Limit the length of automatically generated group names
- BM25 Parameters (k1 and b): Fine-tune the BM25 algorithm if selected
- LSA Dimensions: Adjust the number of dimensions used for semantic analysis when using LSA

To access the settings, right-click the extension icon and select "Options", or use the "Open Settings" button in the popup.

![CleanShot 2024-09-18 at 11 35 11@2x](https://github.com/user-attachments/assets/e093775f-0e2d-4a45-b37b-4936e0b4aa2f)

## Algorithms

### TF-IDF (Term Frequency-Inverse Document Frequency)

Evaluates how important a word is to a document in a collection of documents. It's effective for content-based grouping.

### BM25 (Best Matching 25)

An advanced ranking function used by search engines. It can provide more nuanced grouping based on term importance and document length.

### Keyphrase Extraction

Identifies the most important phrases in the tab content, which can be effective for grouping tabs with similar key topics.

### LSA (Latent Semantic Analysis)

Discovers hidden semantic relationships between tabs by analyzing the underlying structure of the content. It can identify conceptual similarities even when tabs don't share the exact same keywords.

### Quantum Chaos Organizer (QCO)

The Quantum Chaos Organizer (QCO) is an innovative algorithm that leverages principles from chaos theory and quantum mechanics to bring a new paradigm to tab organization. Rather than relying solely on deterministic text analysis, QCO introduces elements of randomness, non-linearity, and quantum uncertainty into the grouping process. Drawing inspiration from phenomena such as quantum superposition, decoherence, and even the unpredictable behavior described by the Schrödinger equation (∇ × (∇ × Ψ) = -∇²Ψ + ∇(∇ · Ψ)), QCO assesses tabs as dynamic entities operating in a state of flux.

Key benefits include:

- Embracing the inherent unpredictability in user behavior to create more adaptive and flexible groupings
- Incorporating principles of quantum randomness to enhance diversity and reduce bias in tab organization
- Maintaining 100% local processing to ensure user privacy, as all computations are performed within the browser
- Adapting to changing browsing patterns through non-deterministic grouping strategies
- Reducing cognitive load by introducing controlled chaos into tab organization

Potential trade-offs involve a higher computational complexity and the possibility of non-deterministic grouping outcomes, which may require fine-tuning and user calibration. Despite these challenges, QCO offers a cutting-edge approach that could redefine how chaotic digital environments, like the modern browser, are organized.

## Tips for Optimal Tab Grouping

Here are some pre-defined settings configurations for different use cases:

### Creative Exploration Mode

- **Algorithm**: QCO
- **Best for**: Brainstorming sessions, creative research, discovering unexpected connections
- **Why**: QCO's non-deterministic approach can reveal surprising relationships between tabs and spark creative insights. The quantum-inspired grouping can help break out of conventional thinking patterns.
- **Tip**: Let the algorithm run multiple times to explore different grouping possibilities

### Research Mode

- **Algorithm**: LSA
- **Similarity Threshold**: 0.25
- **LSA Dimensions**: 50
- **Best for**: Academic research, deep dives into related topics
- **Why**: LSA excels at finding conceptual relationships between tabs even when they use different terminology. The lower similarity threshold ensures related research materials are grouped together.

### Work/Project Focus

- **Algorithm**: BM25
- **Similarity Threshold**: 0.4
- **BM25 k1**: 1.8
- **BM25 b**: 0.8
- **Best for**: Professional work with multiple projects open simultaneously
- **Why**: BM25 handles varying document lengths well, making it ideal for separating different work projects. The higher similarity threshold creates more distinct groups.

### News Reading

- **Algorithm**: Keyphrase Extraction
- **Similarity Threshold**: 0.35
- **Best for**: Reading news from multiple sources on various topics
- **Why**: Keyphrase extraction identifies the main topics regardless of writing style, helping group news articles by subject matter rather than source.

### General Browsing

- **Algorithm**: TF-IDF
- **Similarity Threshold**: 0.3
- **Best for**: Everyday browsing with mixed content
- **Why**: TF-IDF provides a good balance of performance and accuracy for general use, with a moderate threshold that creates intuitive groups.

### Shopping Comparison

- **Algorithm**: Keyphrase Extraction
- **Similarity Threshold**: 0.45
- **Best for**: Comparing products across different stores
- **Why**: The higher threshold ensures only very similar products are grouped together, while keyphrase extraction focuses on product attributes rather than store-specific language.

### Multitasking Chaos Management

- **Algorithm**: QCO
- **Best for**: Managing multiple concurrent tasks with overlapping contexts
- **Why**: QCO's adaptive grouping can help organize tabs when traditional categorization fails. The algorithm's chaos-inspired approach is particularly effective when dealing with tabs that could belong to multiple logical groups.
- **Tip**: Use in combination with pinned tabs for anchoring key resources while letting QCO organize the rest

### Mixed-Mode Strategy

For optimal results in complex workflows, consider alternating between algorithms:

1. Start with QCO for initial organization and discovering unexpected tab relationships
2. Switch to LSA or BM25 for more focused work sessions
3. Use Keyphrase Extraction when needing clear topic-based grouping
4. Return to QCO when tab chaos starts to build up again

Remember that the effectiveness of each algorithm depends on your specific workflow and cognitive style. Don't hesitate to experiment with different combinations and settings to find what works best for you.

## Privacy

[This extension does not collect or transmit any personal data](PRIVACY.md). All text analysis and grouping operations are **performed locally in your browser**.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[GPLv3](LICENSE)

## Troubleshooting

If you encounter any issues:

1. Check the extension's options to ensure settings are configured correctly.
2. Try manually triggering the grouping from the popup.
3. Disable and re-enable the extension.
4. If problems persist, please open an issue on this repository with a detailed description of the problem and your Brave version.

## Future Enhancements

- Firefox Support
- Support for custom grouping algorithms
- Advanced group naming options
- Integration with browser sync for cross-device grouping
- Performance optimizations for handling large numbers of tabs
