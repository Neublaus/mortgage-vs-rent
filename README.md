# mortgage-vs-rent

Web app to calculate real buy-vs-rent cost.

## Deploy to Render (no local install needed)

1. Push this repo to GitHub.
2. Go to Render: https://render.com/ and sign in.
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repo.
5. Render will detect `render.yaml` automatically.
6. Click **Apply** / **Create**.
7. Wait for deploy, then open your public URL:
   - `https://mortgage-vs-rent.onrender.com` (or similar Render-generated URL)

## Local run (optional)

```bash
python3 -m pip install -r requirements.txt
python3 app.py
```

Open:

`http://127.0.0.1:5000/`

Then edit numbers and press **Calculate**.

## Notes

- Enter Zillow Zestimate and Rent Zestimate manually.
- Results include overpay vs rent, opportunity cost, sale proceeds (with/without broker), and break-even sale price.
