// Add PDF upload endpoint
app.post('/rptar/upload', async (req, res) => {
  const { files } = req.body;
  const uploadsDir = `./uploads/${new Date().toISOString().slice(0,10)}`;
  await fs.mkdirSync(uploadsDir);

  const uploadedFiles = [];

  for (const file of files) {
    const uploadedPath = path.join(uploadsDir, file.name);
    await fs.writeFileSync(uploadedPath, file.buffer);
    uploadedFiles.push(uploadedPath);
  }

  // Process single PDF match
  if (uploadedFiles.length === 1) {
    const matchedResults = await matchPdfToSearch(uploadedFiles[0]);
    res.json({ success: true, matches: matchedResults });
  } else {
    // Store multiple PDFs in PIN history
    await saveToPinHistory(uploadedFiles);
    res.json({ success: true, storedInPin: true });
  }
});

// Match single PDF with search results
async function matchPdfToSearch(pdfPath) {
  try {
    // Extract text from PDF
    const dataBuffer = await fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    const extractedText = pdfData.text;

    // Search in database for matching content
    const matches = await db.query(
      'SELECT * FROM search_results WHERE content LIKE ?',
      [`%${extractedText.substring(0, 100)}%`] // Simple match on first 100 chars
    );

    return matches;
  } catch (error) {
    console.error('Error matching PDF to search:', error);
    return [];
  }
}

// Save extracted PDF data to PIN account history
async function saveToPinHistory(pdfFiles) {
  try {
    const historyEntries = [];

    for (const pdfFile of pdfFiles) {
      // Extract text from PDF
      const dataBuffer = await fs.readFileSync(pdfFile);
      const pdfData = await pdf(dataBuffer);
      const extractedText = pdfData.text;

      // Create history entry
      const historyEntry = {
        filename: path.basename(pdfFile),
        content: extractedText,
        uploadedAt: new Date().toISOString(),
        type: 'rptar_pdf'
      };

      historyEntries.push(historyEntry);
    }

    // Save to PIN history table
    await db.query(
      'INSERT INTO pin_history (entries, created_at) VALUES (?, ?)',
      [JSON.stringify(historyEntries), new Date().toISOString()]
    );

    return true;
  } catch (error) {
    console.error('Error saving to PIN history:', error);
    return false;
  }
}