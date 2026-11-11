from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading
import time


def start_http_server(host='127.0.0.1', port=8080):
    server = ThreadingHTTPServer((host, port), SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def main():
    server = start_http_server()
    # Give server a moment to start
    time.sleep(0.2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on('console', lambda msg: print('PAGE_CONSOLE:', msg.text()))

        url = 'http://127.0.0.1:8080/index.html'
        print('Navigating to', url)
        page.goto(url, wait_until='load', timeout=30000)

        page.wait_for_selector('#invoicedAmount', timeout=15000)

        page.evaluate("""
        () => {
            document.getElementById('hourlyRate').value = '700';
            document.getElementById('billableHours').value = '160';
            document.getElementById('otherRevenue').value = '0';
            document.getElementById('otherCosts').value = '20000';
            document.getElementById('billableHours').dispatchEvent(new Event('input'));
            document.getElementById('hourlyRate').dispatchEvent(new Event('input'));
        }
        """)

        # Set required fields for salary/tax calculations
        page.evaluate("""
        () => {
            document.getElementById('yearBorn').value = '1990';
            document.getElementById('kommunalSkattPercent').value = '30';
            document.getElementById('burialSkattPercent').value = '0.2';
            document.getElementById('churchSkattPercent').value = '0';
            if (typeof window.updateAll === 'function') { window.updateAll(); }
        }
        """)

        # Wait for field values to populate (or timeout)
        try:
            page.wait_for_function("document.getElementById('profitAfterTax') && document.getElementById('profitAfterTax').value.length > 0", timeout=5000)
        except Exception:
            pass

        # Diagnostic values
        exists_updateAll = page.evaluate("() => typeof window.updateAll === 'function'")
        grossSalaryYear = page.evaluate("() => document.getElementById('grossSalaryYear') ? document.getElementById('grossSalaryYear').value : ''")
        profitBeforeTax = page.evaluate("() => document.getElementById('profitBeforeTax') ? document.getElementById('profitBeforeTax').value : ''")
        profitAfterTax = page.evaluate("() => document.getElementById('profitAfterTax') ? document.getElementById('profitAfterTax').value : ''")
        totalTax = page.evaluate("() => document.getElementById('totalTax') ? document.getElementById('totalTax').value : ''")
        print('exists_updateAll=', exists_updateAll)
        print('grossSalaryYear=', grossSalaryYear)
        print('profitBeforeTax=', profitBeforeTax)
        print('profitAfterTax=', profitAfterTax)
        print('totalTax=', totalTax)

        browser.close()

    server.shutdown()


if __name__ == '__main__':
    main()
