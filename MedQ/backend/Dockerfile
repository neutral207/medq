
FROM python:3.12


WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

ENV FLASK_APP=src.config.main:create_app

EXPOSE 5000

CMD ["python", "-m", "src.config.main"]

