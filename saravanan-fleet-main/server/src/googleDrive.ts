      const res = await this.drive.files.create({
        requestBody,
        media: {
          mimeType,
          body: fileStream,
        },
        fields: 'id, name, webViewLink, webContentLink',
        supportsAllDrives: true,
      });

      const fileId = res.data.id;
      if (!fileId) {
        throw new Error('Google Drive did not return a file ID');
      }

      // Set public viewing permission (anyone with link can view)
      try {
        await this.drive.permissions.create({
          fileId,
          supportsAllDrives: true,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
      } catch (permErr: any) {
        console.warn(`[GoogleDriveClient] Permission warning for ${fileId}:`, permErr.message);
      }

      const webViewLink =
        res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

      return {
        fileId,
        webViewLink,
        webContentLink: res.data.webContentLink || undefined,
      };
    } catch (err: any) {
      console.error(`[GoogleDriveClient] Failed to upload ${fileName}:`, err.message);
      throw err;
    }
  }
}
